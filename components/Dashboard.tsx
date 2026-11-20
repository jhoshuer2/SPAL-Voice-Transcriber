"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { StatTile } from "@/components/StatTile";
import { JobRow } from "@/components/JobRow";
import { FolderItem } from "@/components/FolderItem";
import { FormatBadge } from "@/components/FormatBadge";
import {
  ReelIcon,
  StackIcon,
  CheckIcon,
  PulseIcon,
  DiscIcon,
  ListViewIcon,
  GridViewIcon,
  ChevronLeftIcon,
  FolderIcon,
  DownloadIcon,
} from "@/components/icons";
import type { Folder, Job } from "@/lib/types";
import { formatBytes, formatHoursMinutes } from "@/lib/format";
import { signOutAction } from "@/app/actions";
import { SignInPrompt, type SignInPromptKind } from "@/components/SignInPrompt";
import { MeetingsMenu } from "@/components/MeetingsMenu";

type LibraryView = "list" | "grid";
const VIEW_STORAGE_KEY = "spool:library-view";

// Ranks a job's progress so a poll can never silently walk it backward.
// Blob storage reads can race a write (see lib/manifest.ts's own note on
// this) — the 5s poll that starts the moment a job goes "active" was
// landing on a pre-transcribe snapshot shortly after someone clicked
// Transcribe, reverting the status to "uploaded" and making the button
// reappear, as if the click hadn't registered.
const STATUS_RANK: Record<Job["status"], number> = {
  uploaded: 0,
  queued: 1,
  processing: 2,
  completed: 3,
  error: 3,
};

function mergeJobs(prev: Job[], incoming: Job[]): Job[] {
  const prevById = new Map(prev.map((j) => [j.id, j]));
  const byId = new Map<string, Job>();
  for (const inc of incoming) {
    const local = prevById.get(inc.id);
    byId.set(inc.id, local && STATUS_RANK[local.status] > STATUS_RANK[inc.status] ? local : inc);
  }
  // A job added (or moved/renamed) locally that this snapshot doesn't
  // have yet, for the same reason — keep it rather than drop it.
  for (const j of prev) {
    if (!byId.has(j.id)) byId.set(j.id, j);
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Bundled with the app (public/sample/) so "try it" needs no upload at
// all. Size is the asset's known byte length — fine to hardcode for a
// fixed, checked-in file.
const SAMPLE_AUDIO = {
  pathname: "sample/welcome-sample.mp3",
  filename: "Say hello to Spool.mp3",
  size: 116342,
  contentType: "audio/mpeg",
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [signInPrompt, setSignInPrompt] = useState<SignInPromptKind | null>(null);
  const [view, setView] = useState<LibraryView>("list");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [tryingSample, setTryingSample] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  // "Install app" — Chrome/Edge/Android fire beforeinstallprompt when the
  // PWA criteria (manifest + service worker) are met; we hold onto that
  // event so the button can trigger it on demand instead of the browser's
  // own (easy-to-miss) install affordance.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  // The grid/list choice is a display preference, not data — remember it
  // locally per browser rather than round-tripping it through the API.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(VIEW_STORAGE_KEY) : null;
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);

  function changeView(next: LibraryView) {
    setView(next);
    if (typeof window !== "undefined") localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

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
      if (res.ok) setJobs((prev) => mergeJobs(prev, data.jobs ?? []));
    } finally {
      setLoaded(true);
    }
  }, []);

  const refreshFolders = useCallback(async () => {
    const res = await fetch("/api/folders", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setFolders(data.folders ?? []);
  }, []);

  useEffect(() => {
    refreshJobs();
    refreshFolders();
  }, [refreshJobs, refreshFolders]);

  // If the folder someone's sitting inside gets deleted (e.g. in another
  // tab), fall back out to the root library instead of showing a dead end.
  useEffect(() => {
    if (currentFolderId && loaded && !folders.some((f) => f.id === currentFolderId)) {
      setCurrentFolderId(null);
    }
  }, [currentFolderId, folders, loaded]);

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
          // Drop it straight into whichever folder is currently open.
          folderId: currentFolderId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not register upload");
      const { job } = await res.json();

      setPending((p) => p.filter((u) => u.key !== key));
      // The POST response already *is* the authoritative row — add it
      // straight to state instead of re-fetching the whole list, which
      // can briefly race the manifest write and come back without it.
      setJobs((prev) => [job, ...prev]);
    } catch (err) {
      setPending((p) =>
        p.map((u) =>
          u.key === key
            ? { ...u, stage: "error", error: err instanceof Error ? err.message : "Upload failed" }
            : u,
        ),
      );
    }
  }, [refreshJobs, currentFolderId]);

  function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    for (const file of files) startUpload(file);
  }

  function dismissPending(key: string) {
    setPending((p) => p.filter((u) => u.key !== key));
  }

  async function handleTranscribe(id: string) {
    // Flip to "queued" the moment the request is accepted, from the
    // response body itself — not from a follow-up GET, which can race
    // the manifest write and still show "uploaded" for a beat. That
    // stale read was exactly why the button seemed to need a second
    // click and why there was no immediate "it's working" feedback.
    const res = await fetch(`/api/jobs/${id}/transcribe`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.job) {
      setJobs((prev) => prev.map((job) => (job.id === id ? data.job : job)));
    } else if (!res.ok) {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === id ? { ...job, status: "error", error: data?.error || "Failed to start" } : job,
        ),
      );
    }
    // No trailing refreshJobs() here — hasActive now flips to true from
    // the optimistic update above, which starts the 5s poll on its own.
  }

  async function handleDelete(id: string) {
    setJobs((j) => j.filter((job) => job.id !== id));
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
  }

  async function handleMove(id: string, folderId: string | null) {
    setJobs((j) => j.map((job) => (job.id === id ? { ...job, folderId } : job)));
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
  }

  async function handleTrySample() {
    if (tryingSample) return;
    setTryingSample(true);
    try {
      const url = `${window.location.origin}/${SAMPLE_AUDIO.pathname}`;
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          pathname: SAMPLE_AUDIO.pathname,
          filename: SAMPLE_AUDIO.filename,
          size: SAMPLE_AUDIO.size,
          contentType: SAMPLE_AUDIO.contentType,
          folderId: currentFolderId,
        }),
      });
      if (!res.ok) throw new Error("Could not add the sample");
      const { job } = await res.json();
      const transcribeRes = await fetch(`/api/jobs/${job.id}/transcribe`, { method: "POST" });
      const transcribeData = await transcribeRes.json().catch(() => null);
      setJobs((prev) => [transcribeData?.job ?? job, ...prev]);
    } catch {
      // Best effort — if this fails the library just won't show a new
      // row, which is self-evident, so there's nothing useful to surface.
    } finally {
      setTryingSample(false);
    }
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newFolderName.trim();
    setCreatingFolder(false);
    setNewFolderName("");
    if (!name) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const { folder } = await res.json();
      setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
    }
  }

  async function handleRenameFolder(id: string, name: string) {
    setFolders((f) => f.map((folder) => (folder.id === id ? { ...folder, name } : folder)));
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function handleDeleteFolder(id: string) {
    setFolders((f) => f.filter((folder) => folder.id !== id));
    // Deleting a folder never deletes its files — the server falls them
    // back to the root library, so mirror that locally right away.
    setJobs((j) => j.map((job) => (job.folderId === id ? { ...job, folderId: null } : job)));
    if (currentFolderId === id) setCurrentFolderId(null);
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
  }

  const currentFolder = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null;
  const visibleJobs = useMemo(
    () => jobs.filter((j) => (j.folderId || null) === currentFolderId),
    [jobs, currentFolderId],
  );
  const jobCountByFolder = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobs) {
      if (j.folderId) counts.set(j.folderId, (counts.get(j.folderId) || 0) + 1);
    }
    return counts;
  }, [jobs]);

  return (
    <main className="shell">
      <div className="hero-zone">
        {/* Illustrated backdrop, scoped and clipped to this wrapper only —
            it can never reach the Library section below because it is
            physically confined to this box (overflow: hidden on
            .hero-zone), not sized to match it via a parallel formula. */}
        <div className="hero-illustration" aria-hidden="true">
          <span className="hero-illustration__note hero-illustration__note--a">♪</span>
          <span className="hero-illustration__note hero-illustration__note--b">♪</span>
        </div>

        {/* .hero-zone itself breaks out to full viewport width so the
            backdrop above reads as a true background, not a framed
            picture in the middle of the page — but the real content
            still needs to line up with the rest of the (max-width,
            centered) page, hence this inner wrapper. */}
        <div className="hero-zone__inner">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__mark" aria-hidden>
            <ReelIcon />
          </span>
          <span className="topbar__name">Spool</span>
          <span className="topbar__badge">Beta</span>
        </div>
        <div className="topbar__right">
          {installPrompt && !installed && (
            <button type="button" className="btn btn--pill" onClick={handleInstallClick}>
              <DownloadIcon />
              <span>Install app</span>
            </button>
          )}
          {user && <MeetingsMenu />}
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
              <a href="/signin" className="btn btn--pill">
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="hero">
        <span className="hero__mark" aria-hidden>
          <ReelIcon />
        </span>
        <h1 className="hero__title">
          {greeting()}{firstName ? `, ${firstName}` : ""} <span aria-hidden>👋</span>
        </h1>
        <p className="hero__tagline">
          Drop in audio of any length — we'll handle the transcript.
        </p>
      </section>

      <p className="section-eyebrow section-eyebrow--actions">Start here</p>

      <section className="hero-actions">
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

        <button
          type="button"
          className={`dropzone ${dragging ? "dropzone--dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
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
        >
          <span className="dropzone__illustration" aria-hidden>
            <span className="format-chip format-chip--behind format-chip--left">
              <FormatBadge filename="voice.m4a" size="lg" />
            </span>
            <span className="format-chip format-chip--center">
              <FormatBadge filename="track.mp3" size="lg" />
            </span>
            <span className="format-chip format-chip--behind format-chip--right">
              <FormatBadge filename="clip.wav" size="lg" />
            </span>
          </span>
          <span className="dropzone__title">Drag and drop to upload audio or video</span>
          <span className="dropzone__sub">or click to browse files — any length, any format</span>
        </button>

        <button
          type="button"
          className="action-card action-card--sample"
          onClick={handleTrySample}
          disabled={tryingSample}
        >
          <span className="action-card__icon" aria-hidden>
            <PulseIcon />
          </span>
          <span className="action-card__body">
            <span className="action-card__title">{tryingSample ? "Starting…" : "Try a 10-second sample"}</span>
            <span className="action-card__sub">No upload needed</span>
          </span>
        </button>

        {creatingFolder ? (
          <form className="action-card action-card--form action-card--folder" onSubmit={handleCreateFolder}>
            <span className="action-card__icon" aria-hidden>
              <FolderIcon />
            </span>
            <input
              autoFocus
              className="action-card__input"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => {
                if (!newFolderName.trim()) setCreatingFolder(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }
              }}
            />
            <button type="submit" className="btn btn--amber action-card__submit">
              Create
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="action-card action-card--folder"
            onClick={() => setCreatingFolder(true)}
          >
            <span className="action-card__icon" aria-hidden>
              <FolderIcon />
            </span>
            <span className="action-card__body">
              <span className="action-card__title">New folder</span>
              <span className="action-card__sub">Group recordings together</span>
            </span>
          </button>
        )}
      </section>

      {pending.length > 0 && (
        <section className="attachments">
          {pending.map((u) => (
            <div key={u.key} className={`attachment ${u.stage === "error" ? "attachment--error" : ""}`}>
              <FormatBadge filename={u.file.name} contentType={u.file.type} size="md" className="attachment__thumb" />
              <div className="attachment__body">
                <div className="attachment__row">
                  <span className="attachment__name">{u.file.name}</span>
                  <button
                    type="button"
                    className="attachment__close"
                    onClick={() => dismissPending(u.key)}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
                {u.stage === "error" ? (
                  <span className="attachment__error-msg">{u.error}</span>
                ) : (
                  <span className="attachment__status">
                    {formatBytes(Math.round((u.file.size * u.progress) / 100))} of {formatBytes(u.file.size)}
                    {" · "}
                    {u.stage === "registering" ? "Saving…" : "Uploading…"}
                  </span>
                )}
                {u.stage !== "error" && (
                  <div className="upload-bar">
                    <span style={{ width: `${u.stage === "registering" ? 100 : u.progress}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
        </div>
      </div>

      <p className="section-eyebrow section-eyebrow--done">So far</p>

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
        <div className="library__toolbar">
          {currentFolder ? (
            <button type="button" className="library__crumb" onClick={() => setCurrentFolderId(null)}>
              <ChevronLeftIcon />
              <span>Library</span>
              <span className="library__crumb-sep">/</span>
              <span className="library__crumb-current">{currentFolder.name}</span>
            </button>
          ) : (
            <h2 className="library__heading">Library</h2>
          )}

          <div className="library__toolbar-actions">
            <div className="view-toggle" role="group" aria-label="Library view">
              <button
                type="button"
                className={`view-toggle__btn ${view === "list" ? "view-toggle__btn--active" : ""}`}
                onClick={() => changeView("list")}
                aria-pressed={view === "list"}
                title="List view"
              >
                <ListViewIcon />
              </button>
              <button
                type="button"
                className={`view-toggle__btn ${view === "grid" ? "view-toggle__btn--active" : ""}`}
                onClick={() => changeView("grid")}
                aria-pressed={view === "grid"}
                title="Grid view"
              >
                <GridViewIcon />
              </button>
            </div>
          </div>
        </div>

        {!loaded ? (
          <p className="library__empty">Loading…</p>
        ) : !currentFolder && folders.length === 0 && visibleJobs.length === 0 ? (
          <p className="library__empty">Nothing here yet — drop a file above to get started.</p>
        ) : currentFolder && visibleJobs.length === 0 ? (
          <p className="library__empty">This folder's empty — drop a file above or move one in.</p>
        ) : (
          <div className={view === "grid" ? "library__grid" : "library__list"}>
            {!currentFolder &&
              folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  fileCount={jobCountByFolder.get(folder.id) || 0}
                  view={view}
                  onOpen={setCurrentFolderId}
                  onRename={handleRenameFolder}
                  onDelete={handleDeleteFolder}
                />
              ))}
            {visibleJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                view={view}
                folders={folders}
                onTranscribe={handleTranscribe}
                onDelete={handleDelete}
                onMove={handleMove}
              />
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
