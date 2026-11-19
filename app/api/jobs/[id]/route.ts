import { NextResponse } from "next/server";
import { getOwnerId } from "@/lib/owner";
import { getJob, removeJob } from "@/lib/manifest";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ownerId = await getOwnerId();
  const job = await getJob(params.id, ownerId);
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
