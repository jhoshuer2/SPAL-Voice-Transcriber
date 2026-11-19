import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { addJob, listJobs } from "@/lib/manifest";
import type { Job } from "@/lib/types";

// GET /api/jobs — the dashboard's single source of truth. Also quietly
// refreshes any job that's still queued/processing against AssemblyAI,
// so the list is current whenever someone looks at it (see
// lib/manifest.ts#refreshActiveJobs).
export async function GET() {
  const jobs = await listJobs();
  return NextResponse.json({ jobs });
}

// POST /api/jobs — register a file that already landed in Blob storage.
// Upload and "create a job" are deliberately separate steps: a file can
// sit here, uploaded but untranscribed, until it's deliberately sent off.
export async function POST(request: Request) {
  const body = (await request.json()) as {
    url?: string;
    pathname?: string;
    filename?: string;
    size?: number;
    contentType?: string | null;
  };

  if (!body.url || !body.pathname) {
    return NextResponse.json({ error: "url and pathname are required" }, { status: 400 });
  }

  const job: Job = {
    id: randomUUID(),
    filename: body.filename || body.pathname.split("/").pop() || "audio file",
    pathname: body.pathname,
    url: body.url,
    size: body.size ?? 0,
    contentType: body.contentType ?? null,
    createdAt: new Date().toISOString(),
    status: "uploaded",
  };

  await addJob(job);
  return NextResponse.json({ job });
}
