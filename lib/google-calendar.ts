import type { CalendarAccount } from "./types";
import { updateAccountTokens } from "./calendar";

/** Refreshes the access token if it's expired/about to expire, persists
 * the new one, and returns a token guaranteed usable right now. */
export async function getFreshAccessToken(account: CalendarAccount): Promise<string> {
  const expiresInMs = new Date(account.accessTokenExpiresAt).getTime() - Date.now();
  if (expiresInMs > 60_000) return account.accessToken;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const accessTokenExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await updateAccountTokens(account.ownerId, { accessToken: data.access_token, accessTokenExpiresAt });
  return data.access_token;
}

export type UpcomingEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  meetingUrl: string;
  platform: "zoom" | "google_meet" | "teams" | "whereby" | "other";
};

const LINK_PATTERNS: [RegExp, UpcomingEvent["platform"]][] = [
  [/https?:\/\/[\w.-]*zoom\.us\/j\/\S+/i, "zoom"],
  [/https?:\/\/meet\.google\.com\/\S+/i, "google_meet"],
  [/https?:\/\/teams\.microsoft\.com\/\S+/i, "teams"],
  [/https?:\/\/(?:[\w-]+\.)?whereby\.com\/\S+/i, "whereby"],
];

function extractMeetingLink(text: string): { url: string; platform: UpcomingEvent["platform"] } | null {
  for (const [re, platform] of LINK_PATTERNS) {
    const m = text.match(re);
    if (m) return { url: m[0].replace(/[),.]+$/, ""), platform };
  }
  return null;
}

/** Pulls events in the next `withinMinutes` minutes that have a
 * recognizable video-call link — in conferenceData, the hangoutLink,
 * or just pasted into the location/description field. */
export async function listUpcomingMeetingLinks(
  accessToken: string,
  withinMinutes: number,
): Promise<UpcomingEvent[]> {
  const now = new Date();
  const max = new Date(now.getTime() + withinMinutes * 60_000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: max.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Calendar list failed (${res.status})`);
  const data = await res.json();

  const events: UpcomingEvent[] = [];
  for (const item of data.items || []) {
    if (item.status === "cancelled") continue;
    const start = item.start?.dateTime || item.start?.date;
    if (!start) continue;

    let found: { url: string; platform: UpcomingEvent["platform"] } | null = null;
    if (item.hangoutLink) found = { url: item.hangoutLink, platform: "google_meet" };
    if (!found && item.conferenceData?.entryPoints) {
      const ep = item.conferenceData.entryPoints.find((e: { entryPointType?: string; uri?: string }) => e.entryPointType === "video");
      if (ep?.uri) found = extractMeetingLink(ep.uri) || { url: ep.uri, platform: "other" };
    }
    if (!found) found = extractMeetingLink(`${item.location || ""} ${item.description || ""}`);
    if (!found) continue;

    events.push({
      id: item.id,
      title: item.summary || "Untitled meeting",
      startTime: start,
      endTime: item.end?.dateTime || item.end?.date,
      meetingUrl: found.url,
      platform: found.platform,
    });
  }
  return events;
}
