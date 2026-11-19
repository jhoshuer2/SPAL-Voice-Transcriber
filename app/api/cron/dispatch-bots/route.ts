import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { listCalendarAccounts, upsertMeeting, listMeetingsForOwner } from "@/lib/calendar";
import { getFreshAccessToken, listUpcomingMeetingLinks } from "@/lib/google-calendar";
import { dispatchBotForMeeting } from "@/lib/dispatch-bot";

// Next statically renders a GET route handler by default unless it sees
// cookies()/headers() from next/headers — reading the raw Request's
// headers (as the auth check below does) doesn't count, so without this
// Next would cache the very first run's response and a cron job would
// just keep re-serving stale JSON forever instead of actually running.
export const dynamic = "force-dynamic";

// GET /api/cron/dispatch-bots — runs every few minutes (see vercel.json).
// For every connected calendar, finds meetings starting imminently and
// sends the bot in, without needing anyone's browser session open.
export async function GET(request: Request) {
  // Vercel signs cron requests with this header when CRON_SECRET is set;
  // skip the check if it isn't configured yet (e.g. first deploy).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.RECALL_API_KEY) {
    return NextResponse.json({ skipped: "RECALL_API_KEY not set" });
  }

  const accounts = await listCalendarAccounts();
  const dispatched: string[] = [];
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      const accessToken = await getFreshAccessToken(account);
      // A short lookahead window: this runs every few minutes, so we
      // only need to catch what's starting imminently. (A long window
      // would also work since we dedupe on calendarEventId, but a short
      // one keeps each run cheap.)
      const events = await listUpcomingMeetingLinks(accessToken, 10);

      for (const event of events) {
        await upsertMeeting({
          id: randomUUID(),
          ownerId: account.ownerId,
          ownerEmail: account.email,
          calendarEventId: event.id,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          meetingUrl: event.meetingUrl,
          platform: event.platform,
          status: "scheduled",
          createdAt: new Date().toISOString(),
        });
      }

      const meetings = await listMeetingsForOwner(account.ownerId);
      const startingNow = meetings.filter((m) => {
        if (m.status !== "scheduled" || m.recallBotId) return false;
        const minutesToStart = (new Date(m.startTime).getTime() - Date.now()) / 60_000;
        return minutesToStart <= 2; // join right around the start time
      });

      for (const meeting of startingNow) {
        await dispatchBotForMeeting(meeting);
        dispatched.push(meeting.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[cron] dispatch failed for ${account.ownerId}`, err);
      errors.push(`${account.ownerId}: ${message}`);
    }
  }

  return NextResponse.json({ dispatched, errors });
}
