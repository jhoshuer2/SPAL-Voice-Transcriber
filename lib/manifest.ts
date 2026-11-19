import { randomUUID } from "crypto";
import { put, list, del } from "@vercel/blob";
import type { Job, Folder } from "./types";
import { fetchTranscript } from "./assemblyai";

export type { Job, JobStatus, Folder } from "./types";

// There's no database here on purpose — this app stays a single Blob
// store. Each "manifest" is one small JSON file living alongside the
// audio files, read-modified-written on every change. That's a real
// tradeoff: concurrent writes can race and the last write wins. For a
// personal/low-traffic tool that's a fine price for not standing up
// Postgres/KV. If this ever gets heavier concurrent use, swap this
// file's internals for a real datastore — nothing outside
// lib/manifest.ts needs to change.

const MANIFEST_PATH = "_manifest/jobs.json";
const FOLDERS_MANIFEST_PATH = "_manifest/folders.json";

export async function readJsonManifest<T>(path: string, key: string): Promise<T[]> {
  const { blobs } = await list({ prefix: path, limit: 1 });
  const entry = blobs.find((b) => b.pathname === path);
  if (!entry) return [];
  try {
    // Bust both our own fetch cache and the Blob CDN's edge cache. The
    // manifest is overwritten in place (same URL, allowOverwrite), so
    // without this a read right after a write can come back stale from
    // an edge node — including stale-empty right after the very first
    // write — which then gets baked back in as "the truth" by whatever
    // writes next. That was silently erasing history.
    const bustedUrl = `${entry.url}${entry.url.includes("?") ? "&" : "?"}t=${Date.now()}`;
    const res = await fetch(bustedUrl, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[manifest] read failed for ${path} with status ${res.status}; treating as empty`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data?.[key]) ? (data[key] as T[]) : [];
  } catch (err) {
    console.error(`[manifest] read threw for ${path}; treating as empty`, err);
    return [];
  }
}

export async function writeJsonManifest<T>(path: string, key: string, items: T[]): Promise<void> {
  await put(path, JSON.stringify({ [key]: items }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    // Default cache is a full year at the edge. Since this same URL is
    // overwritten on every change, that meant reads could keep serving
    // an old (sometimes stale-empty) cached copy indefinitely. Keep this
    // file effectively uncached.
    cacheControlMaxAge: 0,
  });
}

const readManifest = () => readJsonManifest<Job>(MANIFEST_PATH, "jobs");
const writeManifest = (jobs: Job[]) => writeJsonManifest(MANIFEST_PATH, "jobs", jobs);
const readFolders = () => readJsonManifest<Folder>(FOLDERS_MANIFEST_PATH, "folders");
const writeFolders = (folders: Folder[]) => writeJsonManifest(FOLDERS_MANIFEST_PATH, "folders", folders);

/** Check AssemblyAI for any job still mid-flight and fold changes back in. */
async function refreshActiveJobs(jobs: Job[]): Promise<Job[]> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  const active = jobs.filter(
    (j) => apiKey && j.assemblyaiId && (j.status === "queued" || j.status === "processing"),
  );
  if (active.length === 0 || !apiKey) return jobs;

  const patches = await Promise.all(
    active.map(async (j) => {
      const { ok, data } = await fetchTranscript(j.assemblyaiId!, apiKey);
      if (!ok) return null;
      const patch: Partial<Job> = {};
      if (data.status === "completed") {
        patch.status = "completed";
        patch.completedAt = new Date().toISOString();
        if (typeof data.audio_duration === "number") patch.durationSeconds = data.audio_duration;
      } else if (data.status === "error") {
        patch.status = "error";
        patch.error = data.error || "Transcription failed";
      } else if (data.status === "processing" && j.status !== "processing") {
        patch.status = "processing";
      }
      return Object.keys(patch).length ? { id: j.id, patch } : null;
    }),
  );

  const changes = patches.filter(Boolean) as { id: string; patch: Partial<Job> }[];
  if (changes.length === 0) return jobs;

  // Re-read right before writing to shrink the window for clobbering a
  // concurrent write, then apply our patches on top of the latest copy.
  const fresh = await readManifest();
  for (const { id, patch } of changes) {
    const idx = fresh.findIndex((j) => j.id === id);
    if (idx !== -1) fresh[idx] = { ...fresh[idx], ...patch };
  }
  await writeManifest(fresh);

  // A meeting-bot job finishing is the one case nobody's necessarily
  // watching the library to see — email the transcript the moment it's
  // done, exactly once (guarded by transcriptEmailedAt so a concurrent
  // poll from another tab can't double-send).
  for (const { id, patch } of changes) {
    if (patch.status !== "completed") continue;
    const idx = fresh.findIndex((j) => j.id === id);
    const job = idx !== -1 ? fresh[idx] : undefined;
    if (!job) continue;

    if (job.meetingId) {
      try {
        const { updateMeeting } = await import("./calendar");
        await updateMeeting(job.meetingId, { status: "completed", jobId: job.id });
      } catch (err) {
        console.error("[manifest] failed to mark meeting completed", err);
      }
    }

    if (!job.notifyEmail || job.transcriptEmailedAt) continue;
    try {
      const { sendTranscriptEmail } = await import("./resend");
      await sendTranscriptEmail(job);
      job.transcriptEmailedAt = new Date().toISOString();
    } catch (err) {
      console.error("[manifest] failed to email finished transcript", err);
    }
  }
  await writeManifest(fresh);
  return fresh;
}

// The manifest is still one shared file, but every job carries an
// ownerId (lib/owner.ts — an email once signed in, an anonymous
// cookie id until then), and every read/write below is scoped to it.
// One visitor's upload is invisible to, and untouchable by, anyone
// else — signed in or not.

export async function listJobs(ownerId: string): Promise<Job[]> {
  const jobs = await refreshActiveJobs(await readManifest());
  return jobs
    .filter((j) => j.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getJob(id: string, ownerId: string): Promise<Job | undefined> {
  const jobs = await listJobs(ownerId);
  return jobs.find((j) => j.id === id);
}

export async function addJob(job: Job): Promise<void> {
  const jobs = await readManifest();
  jobs.push(job);
  await writeManifest(jobs);
}

export async function updateJob(
  id: string,
  ownerId: string,
  patch: Partial<Job>,
): Promise<Job | undefined> {
  const jobs = await readManifest();
  const idx = jobs.findIndex((j) => j.id === id && j.ownerId === ownerId);
  if (idx === -1) return undefined;
  jobs[idx] = { ...jobs[idx], ...patch };
  await writeManifest(jobs);
  return jobs[idx];
}

export async function removeJob(id: string, ownerId: string): Promise<Job | undefined> {
  const jobs = await readManifest();
  const idx = jobs.findIndex((j) => j.id === id && j.ownerId === ownerId);
  if (idx === -1) return undefined;
  const [removed] = jobs.splice(idx, 1);
  await writeManifest(jobs);
  try {
    await del(removed.url);
  } catch {
    // best effort — don't fail the delete if the blob is already gone
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Folders — a flat (no nesting) way to group files in the library. Same
// ownerId scoping as jobs, stored in their own small manifest file so
// folder housekeeping never touches the (hotter-written) jobs file.

export async function listFolders(ownerId: string): Promise<Folder[]> {
  const folders = await readFolders();
  return folders
    .filter((f) => f.ownerId === ownerId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFolder(ownerId: string, name: string): Promise<Folder> {
  const folders = await readFolders();
  const folder: Folder = {
    id: randomUUID(),
    ownerId,
    name: name.trim().slice(0, 80) || "Untitled folder",
    createdAt: new Date().toISOString(),
  };
  folders.push(folder);
  await writeFolders(folders);
  return folder;
}

export async function renameFolder(
  id: string,
  ownerId: string,
  name: string,
): Promise<Folder | undefined> {
  const folders = await readFolders();
  const idx = folders.findIndex((f) => f.id === id && f.ownerId === ownerId);
  if (idx === -1) return undefined;
  const trimmed = name.trim().slice(0, 80);
  folders[idx] = { ...folders[idx], name: trimmed || folders[idx].name };
  await writeFolders(folders);
  return folders[idx];
}

// Deleting a folder never deletes the files inside it — they fall back
// to the root library (folderId cleared) rather than disappearing.
export async function removeFolder(id: string, ownerId: string): Promise<Folder | undefined> {
  const folders = await readFolders();
  const idx = folders.findIndex((f) => f.id === id && f.ownerId === ownerId);
  if (idx === -1) return undefined;
  const [removed] = folders.splice(idx, 1);
  await writeFolders(folders);

  const jobs = await readManifest();
  let changed = false;
  for (const j of jobs) {
    if (j.ownerId === ownerId && j.folderId === id) {
      j.folderId = null;
      changed = true;
    }
  }
  if (changed) await writeManifest(jobs);

  return removed;
}

// Called right after a successful Google sign-in (see auth.ts) so an
// anonymous visitor's existing library — files and folders both —
// carries over to their account instead of becoming invisible the
// moment they sign in.
export async function migrateOwner(fromOwnerId: string, toOwnerId: string): Promise<void> {
  if (fromOwnerId === toOwnerId) return;

  const jobs = await readManifest();
  let changedJobs = false;
  for (const j of jobs) {
    if (j.ownerId === fromOwnerId) {
      j.ownerId = toOwnerId;
      changedJobs = true;
    }
  }
  if (changedJobs) await writeManifest(jobs);

  const folders = await readFolders();
  let changedFolders = false;
  for (const f of folders) {
    if (f.ownerId === fromOwnerId) {
      f.ownerId = toOwnerId;
      changedFolders = true;
    }
  }
  if (changedFolders) await writeFolders(folders);
}
