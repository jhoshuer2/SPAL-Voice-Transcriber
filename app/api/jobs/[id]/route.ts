import { NextResponse } from "next/server";
import { getOwnerId } from "@/lib/owner";
import { getJob, removeJob, updateJob } from "@/lib/manifest";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ownerId = await getOwnerId();
  const job = await getJob(params.id, ownerId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}

// Currently only used to file/unfile a job into a folder — pass
// `folderId: null` to move it back to the root library.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ownerId = await getOwnerId();
  const body = (await request.json().catch(() => ({}))) as { folderId?: string | null };
  if (!("folderId" in body)) {
    return NextResponse.json({ error: "folderId is required" }, { status: 400 });
  }

  const job = await updateJob(params.id, ownerId, { folderId: body.folderId ?? null });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}

// Deletes the job record *and* its underlying audio file — this is the
// "I'm done with this one" button, not just a dashboard dismissal.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const ownerId = await getOwnerId();
  const job = await removeJob(params.id, ownerId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
