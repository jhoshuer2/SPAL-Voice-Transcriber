// Thin wrapper around Recall.ai's bot API — one unified API that joins
// Zoom, Google Meet, Microsoft Teams and Whereby calls as a participant
// and records them. https://docs.recall.ai
//
// Recall's API is region-scoped — a key created in one region's
// dashboard only works against that region's host. Our workspace is
// eu-central-1 (visible in its dashboard URL), so that's hardcoded
// here rather than guessed; if the workspace ever moves regions, this
// is the one line to change.
const API_BASE = "https://eu-central-1.recall.ai/api/v1";

function apiKey() {
  const key = process.env.RECALL_API_KEY;
  if (!key) throw new Error("RECALL_API_KEY is not set");
  return key;
}

export type RecallBot = {
  id: string;
  status_changes?: { code: string; created_at: string }[];
  video_url?: string;
  media_shortcuts?: { video_mixed?: { data?: { download_url?: string } } };
};

/** Sends a bot into a meeting. Recall will post status updates (joined,
 * in_call, call_ended, done) to `webhookUrl`. */
export async function createBot(meetingUrl: string, webhookUrl: string, botName = "Spool Notetaker") {
  const res = await fetch(`${API_BASE}/bot`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
      webhook_url: webhookUrl,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Recall createBot failed (${res.status}): ${body}`);
  }
  return (await res.json()) as RecallBot;
}

export async function getBot(botId: string): Promise<RecallBot> {
  const res = await fetch(`${API_BASE}/bot/${botId}`, {
    headers: { Authorization: `Token ${apiKey()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Recall getBot failed (${res.status})`);
  return res.json();
}

/** The direct download URL for the bot's recorded audio/video, once
 * the call has ended and Recall has finished processing it. */
export function recordingUrl(bot: RecallBot): string | undefined {
  return bot.media_shortcuts?.video_mixed?.data?.download_url || bot.video_url;
}
