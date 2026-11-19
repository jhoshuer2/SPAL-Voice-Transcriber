"use client";

import { useRef, useState } from "react";
import { FolderIcon } from "@/components/icons";
import type { Folder } from "@/lib/types";

export function FolderItem({
  folder,
  fileCount,
  view,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: Folder;
  fileCount: number;
  view: "list" | "grid";
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(folder.name);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function commitEdit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== folder.name) onRename(folder.id, trimmed);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (window.confirm(`Delete "${folder.name}"? Files inside move back to the library — nothing is deleted.`)) {
      onDelete(folder.id);
    }
  }

  const nameField = editing ? (
    <input
      ref={inputRef}
      className="folder-item__input"
      value={draft}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitEdit();
        } else if (e.key === "Escape") {
          setEditing(false);
          setDraft(folder.name);
        }
      }}
    />
  ) : null;

  if (view === "grid") {
    return (
      <div className="tile folder-item folder-item--grid" onClick={() => !editing && onOpen(folder.id)} role="button" tabIndex={0}>
        <div className="tile__thumb tile__thumb--folder" aria-hidden>
          <FolderIcon />
        </div>
        <div className="tile__body">
          {editing ? (
            nameField
          ) : (
            <span className="tile__name" title={folder.name}>
              {folder.name}
            </span>
          )}
          <span className="tile__meta">{fileCount === 1 ? "1 file" : `${fileCount} files`}</span>
        </div>
        <div className="tile__actions">
          <button type="button" className="btn btn--icon" onClick={startEditing} aria-label="Rename folder" title="Rename">
            ✎
          </button>
          <button type="button" className="btn btn--icon" onClick={handleDelete} aria-label="Delete folder" title="Delete">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="job-row folder-item folder-item--list" onClick={() => !editing && onOpen(folder.id)} role="button" tabIndex={0}>
      <div className="job-row__main">
        <span className="job-row__icon job-row__icon--folder" aria-hidden>
          <FolderIcon />
        </span>
        <div className="job-row__info">
          {editing ? nameField : (
            <span className="job-row__name" title={folder.name}>
              {folder.name}
            </span>
          )}
          <span className="job-row__meta">{fileCount === 1 ? "1 file" : `${fileCount} files`}</span>
        </div>
      </div>
      <div className="job-row__status" />
      <div className="job-row__actions">
        <button type="button" className="btn btn--icon" onClick={startEditing} aria-label="Rename folder" title="Rename">
          ✎
        </button>
        <button type="button" className="btn btn--icon" onClick={handleDelete} aria-label="Delete folder" title="Delete">
          ✕
        </button>
      </div>
    </div>
  );
}
