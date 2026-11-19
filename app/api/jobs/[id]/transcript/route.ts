import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJob } from "@/lib/manifest";
import { fetchTranscript } from "@/lib/assemblyai";

// GET /api/jobs/:id/transcript — the full text/utterances, fetched on
// demand rather than stored in the manifest (keeps that file small;
// AssemblyAI holds on to completed transcripts for us).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const job = await getJob(params.id, session.user.email);
  if (!job || !job.assemblyaiId) {
    return NextResponse.json({ error: "Not transcribed yet" }, { status: 404 });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing ASSEMBLYAI_API_KEY" }, { status: 500 });
  }

  const { ok, data } = await fetchTranscript(job.assemblyaiId, apiKey);
  if (!ok) {
    return NextResponse.json({ error: data.error || "Failed to fetch transcript" }, { status: 500 });
  }

  return NextResponse.json(data);
}
