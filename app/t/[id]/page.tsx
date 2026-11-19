"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Utterance = {
  speaker: string;
  text: string;
  start: number;
  end: number;
};

type TranscriptData = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  text?: string;
  utterances?: Utterance[];
  error?: string;
};

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function transcriptToText(data: TranscriptData) {
  if (data.utterances && data.utterances.length > 0) {
    return data.utterances
      .map((u) => `[${formatTime(u.start)}] Speaker ${u.speaker}: ${u.text}`)
      .join("\n\n");
  }
  return data.text ?? "";
}

export default function TranscriptPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<TranscriptData | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/status/${params.id}`);
        const json = await res.json();
        if (!active) return;

        if (!res.ok) {
          setErr(json.error ?? "Failed to load transcript");
          return;
        }

        setData(json);
        if (json.status === "queued" || json.status === "processing") {
          timer = setTimeout(poll, 4000);
        }
      } catch (e) {
        if (active) setErr(e instanceof Error ? e.message : "Network error");
      }
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [params.id]);

  function download() {
    if (!data) return;
    const body = transcriptToText(data);
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${params.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main style={{ maxWidth: 720, margin: "80px auto", padding: "0 24px" }}>
      <h1>Transcript</h1>

      {err && <p style={{ color: "#c0392b" }}>{err}</p>}

      {!err && !data && <p>Loading…</p>}

      {!err && data && (data.status === "queued" || data.status === "processing") && (
        <p style={{ color: "#555" }}>
          Status: {data.status}… this page updates on its own. Longer
          recordings can take a few minutes.
        </p>
      )}

      {!err && data?.status === "error" && (
        <p style={{ color: "#c0392b" }}>Transcription failed: {data.error}</p>
      )}

      {!err && data?.status === "completed" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <button onClick={download}>Download .txt</button>
            <button onClick={copyLink}>{copied ? "Copied!" : "Copy share link"}</button>
          </div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {data.utterances && data.utterances.length > 0
              ? data.utterances.map((u, i) => (
                  <p key={i}>
                    <strong>
                      [{formatTime(u.start)}] Speaker {u.speaker}:
                    </strong>{" "}
                    {u.text}
                  </p>
                ))
              : data.text}
          </div>
        </>
      )}
    </main>
  );
}
