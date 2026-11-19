"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";

type Stage = "idle" | "uploading" | "starting" | "error";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setError("");
    setStage("uploading");
    setProgress(0);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      setStage("starting");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: blob.url, filename: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start transcription");

      router.push(`/t/${data.id}`);
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const busy = stage === "uploading" || stage === "starting";

  return (
    <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px" }}>
      <h1>Audio → Transcript</h1>
      <p style={{ color: "#555" }}>
        Upload an audio file — any length — and get a transcript you can download
        or share as a link.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/mp4,video/quicktime,video/webm"
          required
          disabled={busy}
        />
        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={busy}>
            {stage === "uploading"
              ? `Uploading… ${progress}%`
              : stage === "starting"
                ? "Starting transcription…"
                : "Transcribe"}
          </button>
        </div>
      </form>

      {stage === "error" && (
        <p style={{ color: "#c0392b", marginTop: 16 }}>{error}</p>
      )}

      <p style={{ color: "#999", fontSize: 13, marginTop: 48 }}>
        Files upload directly to storage, so there's no size limit from this
        server. Long recordings (multi-hour) are supported — the transcript
        page will show progress until it's done.
      </p>
    </main>
  );
}
