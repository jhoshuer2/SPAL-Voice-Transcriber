"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Waveform } from "@/components/Waveform";
import { StatTile } from "@/components/StatTile";
import { JobRow } from "@/components/JobRow";
import { ReelIcon, StackIcon, CheckIcon, PulseIcon, DiscIcon } from "@/components/icons";
import type { Job } from "@/lib/types";
import { formatBytes, formatHoursMinutes } from "@/lib/format";
import { signOutAction } from "@/app/actions";
import { SignInPrompt, type SignInPromptKind } from "@/components/SignInPrompt";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

type DashboardUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | null;

const IDLE_PROMPT_MS = 25_000;
const IDLE_PROMPT_DISMISS_KEY = "spool:idle-prompt-dismissed";

type PendingUpload = {
  key: string;
  file: File;
  progress: number;
  stage: "uploading" | "registering" | "error";
  error?: string;
};

const ACCEPT = "audio/*,video/mp4,video/quicktime,video/webm";

let keySeed = 0;
function nextKey() {
  keySeed += 1;
  return `pending-${Date.now()}-${keySeed}`;
}

export function Dashboard({ user }: { user: DashboardUser }) {
  const firstName = user ? (user.name || user.email || "there").split(" ")[0].split("@")[0] : null;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [signInPrompt, setSignInPrompt] = useState<SignInPromptKind | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  // Sign-in is optional. If nobody's signed in, nudge — once, gently —
  // after a quiet moment, rather than gating anything up front.
  useEffect(() => {
    if (user) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(IDLE_PROMPT_DISMISS_KEY)) return;
    const t = setTimeout(() => setSignInPrompt("idle"), IDLE_PROMPT_MS);
    return () => clearTimeout(t);
  }, [user]);

  function dismissSignInPrompt() {
    setSignInPrompt(null);
    if (typeof window !== "undefined") sessionStorage.setItem(IDLE_PROMPT_DISMISS_KEY, "1");
  }

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setJobs(data.jobs ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  const hasActive = useMemo(
    () => jobs.some((j) => j.status === "queued" || j.status === "processing"),
    [jobs],
  );

  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(refreshJobs, 5000);
    return () => clearInterval(t);
  }, [hasActive, refreshJobs]);

  const stats = useMemo(() => {
    const totalFiles = jobs.length;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const inProgress = jobs.filter((j) => j.status === "queued" || j.status === "processing").length;
    const storageBytes = jobs.reduce((sum, j) => sum + (j.size || 0), 0);
    const audioSeconds = jobs.reduce((sum, j) => sum + (j.durationSeconds || 0), 0);
    return { totalFiles, completed, inProgress, storageBytes, audioSeconds };
  }, [jobs]);

  const startUpload = useCallback(async (file: File) => {
    const key = nextKey();
    setPending((p) => [...p, { key, file, progress: 0, stage: "uploading" }]);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        onUploadProgress: ({ percentage }) =>
          setPending((p) => p.map((u) => (u.key === key ? { ...u, progress: Math.round(percentage) } : u))),
      });

      setPending((p) => p.map((u) => (u.key === key ? { ...u, stage: "registering" } : u)));

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: blob.url,
          pathname: blob.pathname,
          filename: file.name,
          size: file.size,
          contentType: file.type || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not register upload");

      setPending((p) => p.filter((u) => u.key !== key));
      refreshJobs();
    } catch (err) {
      setPending((p) =>
        p.map((u) =>
          u.key === key
            ? { ...u, stage: "error", error: err instanceof Error ? err.message : "Upload failed" }
            : u,
        ),
      );
    }
  }, [refreshJobs]);

  function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    for (const file of files) startUpload(file);
  }

  function dismissPending(key: string) {
    setPending((p) => p.filter((u) => u.key !== key));
  }

  async function handleTranscribe(id: string) {
    await fetch(`/api/jobs/${id}/transcribe`, { method: "POST" });
    refreshJobs();
  }

  async function handleDelete(id: string) {
    setJobs((j) => j.filter((job) => job.id !== id));
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    refreshJobs();
  }

  return (
    <main className="shell">
      <header className="brand">
        <span className="brand__mark" aria-hidden>
          <ReelIcon />
        </span>
        <div>
          <h1 className="brand__title">{greeting()}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="brand__tagline">
            Here's your library — drop in audio of <em>any</em> length, transcribe it whenever you're ready.
          </p>
        </div>
        <div className="user-menu">
          {user ? (
            <div className="user-menu__trigger">
              {user.image ? (
                <img src={user.image} alt="" className="user-menu__avatar" />
              ) : (
                <span className="user-menu__avatar user-menu__avatar--fallback" aria-hidden>
                  {(user.name || user.email || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="user-menu__dropdown">
                {user.name && <span className="user-menu__name">{user.name}</span>}
                {user.email && <span className="user-menu__email">{user.email}</span>}
                <form action={signOutAction}>
                  <button type="submit" className="btn btn--ghost user-menu__signout" title="Sign out">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <a href="/signin" className="btn btn--ghost">
              Sign in
            </a>
          )}
        </div>
      </header>

      <section
        className={`dropzone ${dragging ? "dropzone--active" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="dropzone__icon" aria-hidden>
          ⇪
        </span>
        <span className="dropzone__label">Drop audio files here, or click to browse</span>
        <span className="dropzone__hint">Any length, any number of files at once — uploads go straight to storage</span>
      </section>

      {pending.length > 0 && (
        <section className="attachments">
          {pending.map((u) => (
            <div key={u.key} className={`attachment ${u.stage === "error" ? "attachment--error" : ""}`}>
              {u.stage !== "error" ? (
                <Waveform file={u.file} />
              ) : (
                <div className="attachment__error-body">
                  <span className="attachment__name">{u.file.name}</span>
                  <span className="attachment__error-msg">{u.error}</span>
                </div>
              )}
              <div className="attachment__side">
                {u.stage === "uploading" && (
                  <>
                    <div className="upload-bar">
                      <span style={{ width: `${u.progress}%` }} />
                    </div>
                    <span className="attachment__percent">{u.progress}%</span>
                  </>
                )}
                {u.stage === "registering" && <span className="attachment__percent">saving…</span>}
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => dismissPending(u.key)}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="stats">
        <StatTile label="Files" value={String(stats.totalFiles)} icon={<StackIcon />} />
        <StatTile label="Transcribed" value={String(stats.completed)} tone="sage" icon={<CheckIcon />} />
        <StatTile label="In progress" value={String(stats.inProgress)} tone="amber" icon={<PulseIcon />} />
        <StatTile
          label="Storage used"
          value={formatBytes(stats.storageBytes)}
          sub={stats.audioSeconds ? `${formatHoursMinutes(stats.audioSeconds)} of audio` : undefined}
          icon={<DiscIcon />}
        />
      </section>

      <section className="library">
        <h2 className="library__heading">Library</h2>
        {!loaded ? (
          <p className="library__empty">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="library__empty">Nothing here yet — drop a file above to get started.</p>
        ) : (
          <div className="library__list">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} onTranscribe={handleTranscribe} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>

      {signInPrompt && !user && (
        <SignInPrompt kind={signInPrompt} onDismiss={dismissSignInPrompt} />
      )}
    </main>
  );
}
