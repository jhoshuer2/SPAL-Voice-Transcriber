import { put, list, del } from "@vercel/blob";
import type { Job } from "./types";
import { fetchTranscript } from "./assemblyai";

export type { Job, JobStatus } from "./types";

// There's no database here on purpose — this app stays a single Blob
// store. The "manifest" is one small JSON file (_manifest/jobs.json)
// living alongside the audio files, read-modified-written on every
// change. That's a real tradeoff: concurrent writes can race and the
// last write wins. For a personal/low-traffic tool that's a fine
// price for not standing up Postgres/KV. If this ever gets heavier
// concurrent use, swap this file's internals for a real datastore —
// nothing outside lib/manifest.ts needs to change.

const MANIFEST_PATH = "_manifest/jobs.json";

async function readManifest(): Promise<Job[]> {
  const { blobs } = await list({ prefix: MANIFEST_PATH, limit: 1 });
  const entry = blobs.find((b) => b.pathname === MANIFEST_PATH);
  if (!entry) return [];
  try {
    const res = await fetch(entry.url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.jobs) ? (data.jobs as Job[]) : [];
  } catch {
    return [];
  }
}

async function writeManifest(jobs: Job[]): Promise<void> {
  await put(MANIFEST_PATH, JSON.stringify({ jobs }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

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
  return fresh;
}

export async function listJobs(): Promise<Job[]> {
  const jobs = await refreshActiveJobs(await readManifest());
  return [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getJob(id: string): Promise<Job | undefined> {
  const jobs = await listJobs();
  return jobs.find((j) => j.id === id);
}

export async function addJob(job: Job): Promise<void> {
  const jobs = await readManifest();
  jobs.push(job);
  await writeManifest(jobs);
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job | undefined> {
  const jobs = await readManifest();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return undefined;
  jobs[idx] = { ...jobs[idx], ...patch };
  await writeManifest(jobs);
  return jobs[idx];
}

export async function removeJob(id: string): Promise<Job | undefined> {
  const jobs = await readManifest();
  const idx = jobs.findIndex((j) => j.id === id);
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
