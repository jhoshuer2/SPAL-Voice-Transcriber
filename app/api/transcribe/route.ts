import { NextResponse } from "next/server";

// We deliberately keep no database: AssemblyAI's own transcript id
// *is* our job id and our share-link id. Submitting is a single quick
// request — the actual transcription happens on AssemblyAI's
// infrastructure, asynchronously, so it isn't bound by this function's
// execution time limit no matter how long the audio is.
export async function POST(request: Request) {
  const { audioUrl, filename } = (await request.json()) as {
    audioUrl?: string;
    filename?: string;
  };

  if (!audioUrl) {
    return NextResponse.json({ error: "audioUrl is required" }, { status: 400 });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing ASSEMBLYAI_API_KEY" },
      { status: 500 },
    );
  }

  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true,
      punctuate: true,
      format_text: true,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error || "Failed to submit transcription" },
      { status: res.status },
    );
  }

  return NextResponse.json({ id: data.id, filename: filename ?? null });
}
