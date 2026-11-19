"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Job } from "@/lib/types";
import { formatBytes, formatDuration, formatRelativeTime } from "@/lib/format";
import { MicIcon, CheckIcon, AlertIcon, PulseIcon } from "@/components/icons";

const STATUS_ICON: Record<Job["status"], JSX.Element> = {
  uploaded: <MicIcon />,
  queued: <PulseIcon />,
  processing: <PulseIcon />,
  completed: <CheckIcon />,
  error: <AlertIcon />,
};

const STATUS_LABEL: Record<Job["status"], string> = {
  uploaded: "In storage",
  queued: "Queued",
  processing: "Transcribing",
  completed: "Done",
  error: "Failed",
};

function useElapsed(startedAt: string | undefined, active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!startedAt) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return formatDuration(seconds);
}

export function JobRow({
  job,
  onTranscribe,
  onDelete,
}: {
  job: Job;
  onTranscribe: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const active = job.status === "queued" || job.status === "processing";
  const elapsed = useElapsed(job.startedAt, active);
  const [busy, setBusy] = useState(false);

  async function handleTranscribe() {
    setBusy(true);
    await onTranscribe(job.id);
    setBusy(false);
  }

  function handleDelete() {
    if (window.confirm(`Delete "${job.filename}"? This removes the audio file too.`)) {
      onDelete(job.id);
    }
  }

  return (
    <div className={`job-row job-row--${job.status}`}>
      <div className="job-row__main">
        <span className="job-row__icon" aria-hidden>
          {STATUS_ICON[job.status]}
        </span>
        <div className="job-row__info">
          <span className="job-row__name" title={job.filename}>
            {job.filename}
          </span>
          <span className="job-row__meta">
            {formatBytes(job.size)}
            {job.durationSeconds ? ` · ${formatDuration(job.durationSeconds)} audio` : ""}
            {" · "}
            {formatRelativeTime(job.createdAt)}
          </span>
        </div>
      </div>

      <div className="job-row__status">
        {active ? (
          <div className="rec-indicator">
            <span className="rec-track" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} />
              ))}
            </span>
            <span className="rec-label">
              {STATUS_LABEL[job.status]}
              {elapsed ? ` · ${elapsed}` : ""}
            </span>
          </div>
        ) : job.status === "error" ? (
          <span className="job-row__error" title={job.error}>
            {job.error || "Something went wrong"}
          </span>
        ) : (
          <span className={`status-label status-label--${job.status}`}>{STATUS_LABEL[job.status]}</span>
        )}
      </div>

      <div className="job-row__actions">
        {job.status === "uploaded" && (
          <button type="button" className="btn btn--amber" onClick={handleTranscribe} disabled={busy}>
            {busy ? "Starting…" : "Transcribe"}
          </button>
        )}
        {job.status === "error" && (
          <button type="button" className="btn btn--amber" onClick={handleTranscribe} disabled={busy}>
            {busy ? "Retrying…" : "Retry"}
          </button>
        )}
        {job.status === "completed" && (
          <Link href={`/t/${job.id}`} className="btn btn--ghost">
            Open
          </Link>
        )}
        {active && (
          <Link href={`/t/${job.id}`} className="btn btn--ghost">
            Watch
          </Link>
        )}
        <button type="button" className="btn btn--icon" onClick={handleDelete} aria-label="Delete">
          ✕
        </button>
      </div>
    </div>
  );
}
