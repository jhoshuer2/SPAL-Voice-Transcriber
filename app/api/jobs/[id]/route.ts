import { NextResponse } from "next/server";
import { getJob, removeJob } from "@/lib/manifest";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}

// Deletes the job record *and* its underlying audio file — this is the
// "I'm done with this one" button, not just a dashboard dismissal.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const job = await removeJob(params.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
