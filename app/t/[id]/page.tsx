"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Job } from "@/lib/types";
import { formatDuration } from "@/lib/format";

type Utterance = { speaker: string; text: string; start: number; end: number };
type TranscriptData = { text?: string; utterances?: Utterance[] };

function transcriptToText(data: TranscriptData) {
  if (data.utterances && data.utterances.length > 0) {
    return data.utterances
      .map((u) => `[${formatDuration(u.start / 1000)}] Speaker ${u.speaker}: ${u.text}`)
      .join("\n\n");
  }
  return data.text ?? "";
}

export default function TranscriptPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${params.id}`, { cache: "no-store" });
        const json = await res.json();
        if (!active) return;

        if (!res.ok) {
          setErr(json.error ?? "Failed to load this file");
          return;
        }

        setJob(json.job as Job);
        if (json.job.status === "queued" || json.job.status === "processing") {
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

  useEffect(() => {
    if (job?.status !== "completed" || !job.assemblyaiId) return;
    let active = true;
    fetch(`/api/jobs/${params.id}/transcript`)
      .then((res) => res.json())
      .then((data) => {
        if (active) setTranscript(data);
      });
    return () => {
      active = false;
    };
  }, [job?.status, job?.assemblyaiId, params.id]);

  useEffect(() => {
    if (!job?.startedAt || (job.status !== "queued" && job.status !== "processing")) return;
    const start = new Date(job.startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [job?.startedAt, job?.status]);

  function download() {
    if (!transcript) return;
    const body = transcriptToText(transcript);
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job?.filename?.replace(/\.[^/.]+$/, "") || "transcript"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="shell shell--narrow">
      <Link href="/" className="back-link">
        ← Library
      </Link>

      <h1 className="transcript-title">{job?.filename ?? "Transcript"}</h1>

      {err && <p className="error-text">{err}</p>}

      {!err && !job && <p className="library__empty">Loading…</p>}

      {!err && job?.status === "uploaded" && (
        <p className="library__empty">
          This file hasn't been sent for transcription yet. Head back to the library to start it.
        </p>
      )}

      {!err && (job?.status === "queued" || job?.status === "processing") && (
        <div className="rec-indicator rec-indicator--large">
          <span className="rec-track" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} />
            ))}
          </span>
          <span className="rec-label">
            {job.status === "queued" ? "Queued" : "Transcribing"} · {formatDuration(elapsed)} elapsed
          </span>
        </div>
      )}
      {!err && (job?.status === "queued" || job?.status === "processing") && (
        <p className="library__empty" style={{ marginTop: 12 }}>
          This page checks in on its own — longer recordings can take a few minutes.
        </p>
      )}

      {!err && job?.status === "error" && (
        <p className="error-text">Transcription failed: {job.error}</p>
      )}

      {!err && job?.status === "completed" && (
        <>
          <div className="transcript-actions">
            <button type="button" className="btn btn--amber" onClick={download} disabled={!transcript}>
              Download .txt
            </button>
            <button type="button" className="btn btn--ghost" onClick={copyLink}>
              {copied ? "Copied!" : "Copy share link"}
            </button>
          </div>
          <div className="transcript-body">
            {!transcript ? (
              <p className="library__empty">Loading transcript…</p>
            ) : transcript.utterances && transcript.utterances.length > 0 ? (
              transcript.utterances.map((u, i) => (
                <p key={i}>
                  <span className="transcript-body__meta">
                    [{formatDuration(u.start / 1000)}] Speaker {u.speaker}:
                  </span>{" "}
                  {u.text}
                </p>
              ))
            ) : (
              <p>{transcript.text}</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
