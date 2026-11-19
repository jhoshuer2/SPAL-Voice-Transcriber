// Thin wrapper around the two AssemblyAI endpoints we use. No SDK —
// it's two JSON requests, and keeping it bare keeps the cold-start
// and dependency footprint small.

export type AssemblyAITranscript = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  text?: string;
  utterances?: { speaker: string; text: string; start: number; end: number }[];
  audio_duration?: number;
  error?: string;
};

export async function submitTranscript(audioUrl: string, apiKey: string) {
  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true,
      punctuate: true,
      format_text: true,
    }),
  });
  const data = (await res.json()) as AssemblyAITranscript & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export async function fetchTranscript(id: string, apiKey: string) {
  const res = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
    headers: { authorization: apiKey },
    cache: "no-store",
  });
  const data = (await res.json()) as AssemblyAITranscript & { error?: string };
  return { ok: res.ok, status: res.status, data };
}
