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
};

/** A user-created grouping for files in the library. Folders are flat — no nesting. */
export type Folder = {
  id: string;
  /** Same ownerId scoping as Job — see lib/owner.ts. */
  ownerId: string;
  name: string;
  createdAt: string; // ISO timestamp
};
