import { readJsonManifest, writeJsonManifest } from "./manifest";
import type { CalendarAccount, Meeting } from "./types";

// Same JSON-manifest-in-Blob pattern as jobs/folders (see manifest.ts's
// header comment for the tradeoffs). Kept in their own files so the
// much-hotter-written jobs manifest never contends with these.
const ACCOUNTS_PATH = "_manifest/calendar-accounts.json";
const MEETINGS_PATH = "_manifest/meetings.json";

const readAccounts = () => readJsonManifest<CalendarAccount>(ACCOUNTS_PATH, "accounts");
const writeAccounts = (a: CalendarAccount[]) => writeJsonManifest(ACCOUNTS_PATH, "accounts", a);
const readMeetings = () => readJsonManifest<Meeting>(MEETINGS_PATH, "meetings");
const writeMeetings = (m: Meeting[]) => writeJsonManifest(MEETINGS_PATH, "meetings", m);

export async function getCalendarAccount(ownerId: string): Promise<CalendarAccount | undefined> {
  const accounts = await readAccounts();
  return accounts.find((a) => a.ownerId === ownerId);
}

export async function listCalendarAccounts(): Promise<CalendarAccount[]> {
  return readAccounts();
}

/** Called from the Auth.js jwt callback the moment someone grants
 * Calendar read access — this is the only path that captures a
 * refresh token, since there's no DB adapter persisting accounts. */
export async function saveCalendarAccount(account: CalendarAccount): Promise<void> {
  const accounts = await readAccounts();
  const idx = accounts.findIndex((a) => a.ownerId === account.ownerId);
  if (idx === -1) accounts.push(account);
  else accounts[idx] = { ...accounts[idx], ...account };
  await writeAccounts(accounts);
}

export async function removeCalendarAccount(ownerId: string): Promise<void> {
  const accounts = await readAccounts();
  await writeAccounts(accounts.filter((a) => a.ownerId !== ownerId));
}

export async function updateAccountTokens(
  ownerId: string,
  patch: Pick<CalendarAccount, "accessToken" | "accessTokenExpiresAt"> & { refreshToken?: string },
): Promise<void> {
  const accounts = await readAccounts();
  const idx = accounts.findIndex((a) => a.ownerId === ownerId);
  if (idx === -1) return;
  accounts[idx] = { ...accounts[idx], ...patch };
  await writeAccounts(accounts);
}

export async function listMeetingsForOwner(ownerId: string): Promise<Meeting[]> {
  const meetings = await readMeetings();
  return meetings.filter((m) => m.ownerId === ownerId).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export async function getAllMeetings(): Promise<Meeting[]> {
  return readMeetings();
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  const meetings = await readMeetings();
  return meetings.find((m) => m.id === id);
}

export async function upsertMeeting(meeting: Meeting): Promise<void> {
  const meetings = await readMeetings();
  const idx = meetings.findIndex((m) => m.calendarEventId === meeting.calendarEventId && m.ownerId === meeting.ownerId);
  if (idx === -1) {
    meetings.push(meeting);
  } else {
    // A calendar sync only refreshes what the calendar actually knows
    // (title/time/link) — it must never stomp on bot/transcript
    // progress the dispatch flow already recorded for this event.
    const existing = meetings[idx];
    meetings[idx] = {
      ...existing,
      title: meeting.title,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      meetingUrl: meeting.meetingUrl,
      platform: meeting.platform,
    };
  }
  await writeMeetings(meetings);
}

export async function updateMeeting(id: string, patch: Partial<Meeting>): Promise<Meeting | undefined> {
  const meetings = await readMeetings();
  const idx = meetings.findIndex((m) => m.id === id);
  if (idx === -1) return undefined;
  meetings[idx] = { ...meetings[idx], ...patch };
  await writeMeetings(meetings);
  return meetings[idx];
}

export async function findMeetingByBotId(botId: string): Promise<Meeting | undefined> {
  const meetings = await readMeetings();
  return meetings.find((m) => m.recallBotId === botId);
}
