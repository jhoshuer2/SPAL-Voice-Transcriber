// Spool's icon set — a small "tape deck" language, not a generic UI-kit
// outline set. Three signature moves recur across these instead of one
// uniform stroke weight everywhere: a clipped corner on container shapes
// (echoing a cassette shell's cut corner), solid filled accents at a
// shape's single most important point (an on-air dot, a status mark)
// rather than everything being an outline, and real audio/tape motifs in
// place of generic stand-ins — level bars instead of an EKG pulse, a reel
// instead of a plain disc, a rewind glyph instead of a bare chevron.

const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={2}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M10.2 6.6h3.6" strokeWidth={1.2} />
      <path d="M10.2 9h3.6" strokeWidth={1.2} />
      <path d="M10.2 11.4h3.6" strokeWidth={1.2} />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v2" />
      <circle cx="12" cy="21.1" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base}>
      <path d="M5 12.5 9.5 17" strokeWidth={2.6} />
      <path d="M9.5 17 19 7" strokeWidth={1.7} />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8}>
      <path d="M10.3 4.6h3.4L21.3 19H2.7Z" />
      <rect x="11" y="9" width="2" height="5" rx="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8}>
      <path d="M6.5 4H14.2L17 6.8V15a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 14.5V6.5A2.5 2.5 0 0 1 6.5 4Z" />
      <path d="M8.5 20h8a2.5 2.5 0 0 0 2.5-2.5v-8" />
    </svg>
  );
}

export function PulseIcon() {
  // Level bars, not a heartbeat line — this is an audio app.
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
      <path d="M4 10.5v3" />
      <path d="M8.3 7.5v9" />
      <path d="M12 4.5v15" />
      <path d="M15.7 8.5v7" />
      <path d="M20 10.5v3" />
    </svg>
  );
}

export function DiscIcon() {
  // A reel in outline form (the logo mark's solid-fill sibling) rather
  // than a generic record/disc glyph.
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.7}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.1" />
      <path d="M12 8.7V5.2" />
      <path d="m15.4 13.8 3.2 2" />
      <path d="m8.6 13.8-3.2 2" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8}>
      <path d="M4 8a1.5 1.5 0 0 1 1.5-1.5h3.3l1.6 2a1.5 1.5 0 0 0 1.2.6h5.4l2 2v7a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 18.1Z" />
    </svg>
  );
}

export function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path
        d="M10 9.3v5.4a.6.6 0 0 0 .9.52l4.7-2.7a.6.6 0 0 0 0-1.04l-4.7-2.7a.6.6 0 0 0-.9.52Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function ListViewIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={2}>
      <circle cx="4.5" cy="7" r="1" fill="currentColor" stroke="none" />
      <path d="M8 7h11" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M8 12h7.5" />
      <circle cx="4.5" cy="17" r="1" fill="currentColor" stroke="none" />
      <path d="M8 17h9.5" />
    </svg>
  );
}

export function GridViewIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8}>
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <path d="M13 6.2a2.2 2.2 0 0 1 2.2-2.2H20v4.8a2.2 2.2 0 0 1-2.2 2.2H13Z" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={2} strokeLinecap="square">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  // A rewind glyph ("previous") rather than a bare chevron — reads as
  // "back" and ties to the product's own vocabulary.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 5 10 19 4 12Z" />
      <path d="M17 5 17 19 11 12Z" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8}>
      <path d="M12 3.5v10.3" strokeWidth={2.2} />
      <path d="M7.8 8 12 3.5 16.2 8" strokeWidth={1.6} />
      <path d="M5 15.5v2.8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.8" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8}>
      <path d="M12 3.5v10.3" strokeWidth={1.6} />
      <path d="M7.8 10 12 14.2 16.2 10" strokeWidth={2.2} />
      <path d="M5 15.5v2.8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.8" />
    </svg>
  );
}

// The logo mark: a bold, flat-color spool/reel disc — a solid ring with a
// center pin, read at a glance as a reel of tape. currentColor gives the
// fill; the ring cutout uses --bg so it reads correctly wherever it sits.
// Left as-is — it's already a distinct mark, and the rest of the set above
// is now drawn to sit alongside it rather than clash with it.
export function ReelIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <circle cx="12" cy="12" r="6.1" fill="var(--bg)" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
