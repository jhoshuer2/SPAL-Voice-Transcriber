"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Folder, Job } from "@/lib/types";
import { formatBytes, formatDuration, formatRelativeTime } from "@/lib/format";
import { MicIcon, VideoIcon, CheckIcon, AlertIcon, PulseIcon } from "@/components/icons";

const STATUS_LABEL: Record<Job["status"], string> = {
  uploaded: "In storage",
  queued: "Queued",
  processing: "Transcribing",
  completed: "Done",
  error: "Failed",
};

function isVideo(job: Job) {
  return Boolean(job.contentType?.startsWith("video/"));
}

function FileIcon({ job }: { job: Job }) {
  if (job.status === "completed") return <CheckIcon />;
  if (job.status === "error") return <AlertIcon />;
  if (job.status === "queued" || job.status === "processing") return <PulseIcon />;
  return isVideo(job) ? <VideoIcon /> : <MicIcon />;
}

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

function MoveSelect({
  job,
  folders,
  onMove,
}: {
  job: Job;
  folders: Folder[];
  onMove: (id: string, folderId: string | null) => void;
}) {
  if (folders.length === 0) return null;
  return (
    <select
      className="move-select"
      value={job.folderId || ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onMove(job.id, e.target.value || null)}
      title="Move to folder"
      aria-label="Move to folder"
    >
      <option value="">Library (no folder)</option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}

export function JobRow({
  job,
  view = "list",
  folders = [],
  onTranscribe,
  onDelete,
  onMove,
}: {
  job: Job;
  view?: "list" | "grid";
  folders?: Folder[];
  onTranscribe: (id: string) => void;
  onDelete: (id: string) => void;
  onMove?: (id: string, folderId: string | null) => void;
}) {
  const active = job.status === "queued" || job.status === "processing";
  const elapsed = useElapsed(job.startedAt, active);
  const [busy, setBusy] = useState(false);

  async function handleTranscribe() {
    setBusy(true);
    await onTranscribe(job.id);
    setBusy(false);
  }

  function handleDelete(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (window.confirm(`Delete "${job.filename}"? This removes the audio file too.`)) {
      onDelete(job.id);
    }
  }

  const statusBit = active ? (
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
  );

  const actions = (
    <>
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
        <Link href={`/t/${job.id}`} className="btn btn--ghost" onClick={(e) => e.stopPropagation()}>
          Open
        </Link>
      )}
      {active && (
        <Link href={`/t/${job.id}`} className="btn btn--ghost" onClick={(e) => e.stopPropagation()}>
          Watch
        </Link>
      )}
      {onMove && <MoveSelect job={job} folders={folders} onMove={onMove} />}
      <button type="button" className="btn btn--icon" onClick={handleDelete} aria-label="Delete">
        ✕
      </button>
    </>
  );

  if (view === "grid") {
    return (
      <div className={`tile job-tile job-tile--${job.status}`}>
        <div className="tile__thumb" aria-hidden>
          <FileIcon job={job} />
        </div>
        <div className="tile__body">
          <span className="tile__name" title={job.filename}>
            {job.filename}
          </span>
          <span className="tile__meta">
            {formatBytes(job.size)}
            {job.durationSeconds ? ` · ${formatDuration(job.durationSeconds)}` : ""}
          </span>
          <div className="tile__status">{statusBit}</div>
        </div>
        <div className="tile__actions">{actions}</div>
      </div>
    );
  }

  return (
    <div className={`job-row job-row--${job.status}`}>
      <div className="job-row__main">
        <span className="job-row__icon" aria-hidden>
          <FileIcon job={job} />
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

      <div className="job-row__status">{statusBit}</div>

      <div className="job-row__actions">{actions}</div>
    </div>
  );
}
