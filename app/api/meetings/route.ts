import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getOwnerId } from "@/lib/owner";
import { getCalendarAccount, listMeetingsForOwner, upsertMeeting } from "@/lib/calendar";
import { getFreshAccessToken, listUpcomingMeetingLinks } from "@/lib/google-calendar";

// GET /api/meetings — the dashboard's upcoming-meetings list. Syncs
// against Google Calendar first (cheap: one events.list call) so new
// or rescheduled meetings show up without waiting for the cron job,
// then returns what's on file (which carries bot/transcript status
// the calendar itself doesn't know about).
export async function GET() {
  const ownerId = await getOwnerId();
  const account = await getCalendarAccount(ownerId);
  if (!account) {
    return NextResponse.json({ connected: false, meetings: [] });
  }

  try {
    const accessToken = await getFreshAccessToken(account);
    const events = await listUpcomingMeetingLinks(accessToken, 60 * 24 * 7); // next 7 days
    for (const event of events) {
      await upsertMeeting({
        id: randomUUID(),
        ownerId,
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
  } catch (err) {
    console.error("[meetings] calendar sync failed", err);
    // Fall through and serve whatever's already on file — a sync hiccup
    // shouldn't blank the list.
  }

  const meetings = await listMeetingsForOwner(ownerId);
  return NextResponse.json({ connected: true, email: account.email, meetings });
}
