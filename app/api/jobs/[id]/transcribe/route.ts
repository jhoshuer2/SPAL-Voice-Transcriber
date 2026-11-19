import { NextResponse } from "next/server";
import { getOwnerId } from "@/lib/owner";
import { getJob, updateJob } from "@/lib/manifest";
import { submitTranscript } from "@/lib/assemblyai";

// POST /api/jobs/:id/transcribe — the deliberate "send it off" step.
// Submitting to AssemblyAI is a single fast request; the actual
// transcription runs on their infrastructure, so it's never bound by
// this function's execution-time limit, no matter how long the audio is.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const ownerId = await getOwnerId();

  const job = await getJob(params.id, ownerId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (job.assemblyaiId && job.status !== "error") {
    // Already started (or finished) — this is idempotent, not an error.
    return NextResponse.json({ job });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing ASSEMBLYAI_API_KEY" }, { status: 500 });
  }

  const { ok, data } = await submitTranscript(job.url, apiKey);
  if (!ok) {
    await updateJob(job.id, ownerId, {
      status: "error",
      error: data.error || "Failed to submit transcription",
    });
    return NextResponse.json({ error: data.error || "Failed to submit transcription" }, { status: 500 });
  }

  const updated = await updateJob(job.id, ownerId, {
    assemblyaiId: data.id,
    status: "queued",
    startedAt: new Date().toISOString(),
    error: undefined,
  });
  return NextResponse.json({ job: updated ?? job });
}
