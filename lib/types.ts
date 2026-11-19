export type JobStatus = "uploaded" | "queued" | "processing" | "completed" | "error";

export type Job = {
  id: string;
  /**
   * Scopes the shared manifest to one owner — either `email:<address>`
   * once someone's signed in, or `anon:<cookie-id>` before they have.
   * See lib/owner.ts.
   */
  ownerId: string;
  filename: string;
  /** Blob pathname, used to delete the underlying file. */
  pathname: string;
  url: string;
  size: number;
  contentType: string | null;
  createdAt: string; // ISO timestamp
  status: JobStatus;
  assemblyaiId?: string;
  /** When transcription was actually kicked off — used to show elapsed time. */
  startedAt?: string;
  durationSeconds?: number;
  completedAt?: string;
  error?: string;
  /** Which folder this file's been filed into. null/absent = the root library. */
  folderId?: string | null;
  /** Set when this job came from a meeting bot rather than a direct upload. */
  meetingId?: string;
  /** Where to email the finished transcript — the meeting owner's address. */
  notifyEmail?: string;
  /** Guards against emailing the same finished transcript twice. */
  transcriptEmailedAt?: string;
};

/** A linked calendar account — holds the refresh token so a cron job can
 * read someone's calendar and dispatch meeting bots without their
 * browser session being open. One per signed-in owner. */
export type CalendarAccount = {
  ownerId: string;
  email: string;
  provider: "google";
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: string; // ISO timestamp
  connectedAt: string;
};

export type MeetingStatus =
  | "scheduled"
  | "bot_joining"
  | "in_call"
  | "call_ended"
  | "transcribing"
  | "completed"
  | "failed";

/** One calendar event we've found a meeting link on, and (once sent) the
 * bot we dispatched to sit in on it. */
export type Meeting = {
  id: string;
  ownerId: string;
  ownerEmail: string;
  calendarEventId: string;
  title: string;
  startTime: string; // ISO timestamp
  endTime?: string;
  meetingUrl: string;
  platform: "zoom" | "google_meet" | "teams" | "whereby" | "other";
  status: MeetingStatus;
  recallBotId?: string;
  jobId?: string;
  error?: string;
  createdAt: string;
};

/** A user-created grouping for files in the library. Folders are flat — no nesting. */
export type Folder = {
  id: string;
  /** Same ownerId scoping as Job — see lib/owner.ts. */
  ownerId: string;
  name: string;
  createdAt: string; // ISO timestamp
};
