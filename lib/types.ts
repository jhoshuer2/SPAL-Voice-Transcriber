export type JobStatus = "uploaded" | "queued" | "processing" | "completed" | "error";

export type Job = {
  id: string;
  /** Google account email that uploaded this file. Scopes the shared manifest to one owner. */
  ownerEmail: string;
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
};
