"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Waveform } from "@/components/Waveform";
import { StatTile } from "@/components/StatTile";
import { JobRow } from "@/components/JobRow";
import { FolderItem } from "@/components/FolderItem";
import {
  ReelIcon,
  StackIcon,
  CheckIcon,
  PulseIcon,
  DiscIcon,
  ListViewIcon,
  GridViewIcon,
  PlusIcon,
  ChevronLeftIcon,
} from "@/components/icons";
import type { Folder, Job } from "@/lib/types";
import { formatBytes, formatHoursMinutes } from "@/lib/format";
import { signOutAction } from "@/app/actions";
import { SignInPrompt, type SignInPromptKind } from "@/components/SignInPrompt";

type LibraryView = "list" | "grid";
const VIEW_STORAGE_KEY = "spool:library-view";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

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
      if (res.ok) setJobs(data.jobs ?? []);
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
  }, [refreshJobs, currentFolderId]);

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

  async function handleMove(id: string, folderId: string | null) {
    setJobs((j) => j.map((job) => (job.id === id ? { ...job, folderId } : job)));
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    refreshJobs();
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
    if (res.ok) refreshFolders();
  }

  async function handleRenameFolder(id: string, name: string) {
    setFolders((f) => f.map((folder) => (folder.id === id ? { ...folder, name } : folder)));
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    refreshFolders();
  }

  async function handleDeleteFolder(id: string) {
    setFolders((f) => f.filter((folder) => folder.id !== id));
    if (currentFolderId === id) setCurrentFolderId(null);
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
    refreshFolders();
    refreshJobs();
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
            {!currentFolder &&
              (creatingFolder ? (
                <form className="new-folder-form" onSubmit={handleCreateFolder}>
                  <input
                    autoFocus
                    className="new-folder-form__input"
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
                  <button type="submit" className="btn btn--amber">
                    Create
                  </button>
                </form>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setCreatingFolder(true)}>
                  <PlusIcon />
                  New folder
                </button>
              ))}

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
