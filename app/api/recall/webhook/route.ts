import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { findMeetingByBotId, updateMeeting } from "@/lib/calendar";
import { getBot, recordingUrl } from "@/lib/recall";
import { addJob } from "@/lib/manifest";
import { submitTranscript } from "@/lib/assemblyai";
import type { Job, MeetingStatus } from "@/lib/types";

// POST /api/recall/webhook — Recall.ai posts bot status changes here
// (joining, in_call_recording, call_ended, done, fatal). We only act on
// the ones that mean "a finished recording might be ready."
const STATUS_MAP: Record<string, MeetingStatus> = {
  joining_call: "bot_joining",
  in_call_recording: "in_call",
  call_ended: "call_ended",
  done: "call_ended",
  fatal: "failed",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const botId: string | undefined = body?.data?.bot_id || body?.bot_id;
  const statusCode: string | undefined = body?.data?.status?.code || body?.status?.code;
  if (!botId) return NextResponse.json({ ok: true }); // nothing we can act on

  const meeting = await findMeetingByBotId(botId);
  if (!meeting) return NextResponse.json({ ok: true });

  const mapped = statusCode ? STATUS_MAP[statusCode] : undefined;
  if (mapped) await updateMeeting(meeting.id, { status: mapped });

  // Only "call_ended"/"done" means there's something to fetch — every
  // other status is just a progress update we've already recorded above.
  if (statusCode !== "call_ended" && statusCode !== "done") {
    return NextResponse.json({ ok: true });
  }

  try {
    const bot = await getBot(botId);
    const url = recordingUrl(bot);
    if (!url) return NextResponse.json({ ok: true }); // recording not processed yet — a later webhook will have it

    const audioRes = await fetch(url);
    if (!audioRes.ok) throw new Error(`Failed to download recording (${audioRes.status})`);
    const buffer = await audioRes.arrayBuffer();

    const filename = `${meeting.title.replace(/[^\w\s-]/g, "").trim() || "meeting"}.mp4`;
    const pathname = `meetings/${meeting.id}/${randomUUID()}-${filename}`;
    const blob = await put(pathname, Buffer.from(buffer), {
      access: "public",
      addRandomSuffix: false,
      contentType: "video/mp4",
    });

    const job: Job = {
      id: randomUUID(),
      ownerId: meeting.ownerId,
      filename,
      pathname: blob.pathname,
      url: blob.url,
      size: buffer.byteLength,
      contentType: "video/mp4",
      createdAt: new Date().toISOString(),
      status: "uploaded",
      folderId: null,
      meetingId: meeting.id,
      notifyEmail: meeting.ownerEmail,
    };
    await addJob(job);

    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (apiKey) {
      const { ok, data } = await submitTranscript(job.url, apiKey);
      if (ok) {
        // Mirrors /api/jobs/[id]/transcribe's own patch shape — see that
        // route if this ever needs to diverge.
        const { updateJob } = await import("@/lib/manifest");
        await updateJob(job.id, job.ownerId, {
          assemblyaiId: data.id,
          status: "queued",
          startedAt: new Date().toISOString(),
        });
      }
    }

    await updateMeeting(meeting.id, { status: "transcribing", jobId: job.id });
  } catch (err) {
    console.error("[recall webhook] failed to process finished recording", err);
    await updateMeeting(meeting.id, {
      status: "failed",
      error: err instanceof Error ? err.message : "Failed to process recording",
    });
  }

  return NextResponse.json({ ok: true });
}
