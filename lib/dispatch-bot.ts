import { createBot } from "./recall";
import { updateMeeting } from "./calendar";
import { appUrl } from "./url";
import type { Meeting } from "./types";

/** Sends a Recall.ai bot into a meeting and records the attempt. Shared
 * by the manual "join now" button and the cron auto-dispatcher so both
 * paths behave identically. */
export async function dispatchBotForMeeting(meeting: Meeting) {
  const webhookUrl = `${appUrl()}/api/recall/webhook`;
  try {
    const bot = await createBot(meeting.meetingUrl, webhookUrl, "Spool Notetaker");
    return updateMeeting(meeting.id, { status: "bot_joining", recallBotId: bot.id, error: undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to dispatch bot";
    return updateMeeting(meeting.id, { status: "failed", error: message });
  }
}
