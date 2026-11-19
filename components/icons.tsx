// Small outline icon set, drawn by hand to match the dashboard's thin
// (1.5px) stroke style. Deliberately tiny — just the handful this app needs.

const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17.2v.1" />
    </svg>
  );
}

export function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="4" y="4" width="13" height="13" rx="3" />
      <path d="M8.5 20h8a2.5 2.5 0 0 0 2.5-2.5v-8" />
    </svg>
  );
}

export function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </svg>
  );
}

export function DiscIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h4.1a1.5 1.5 0 0 1 1.2.6l1.2 1.65a1.5 1.5 0 0 0 1.2.6h5.3A1.5 1.5 0 0 1 20 10.35v8.15A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-11Z" />
    </svg>
  );
}

export function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="3" y="6.5" width="13" height="11" rx="2.5" />
      <path d="M16 10.3 21 7.5v9L16 13.7" />
    </svg>
  );
}

export function ListViewIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M9 6.5h11" />
      <path d="M9 12h11" />
      <path d="M9 17.5h11" />
      <path d="M4.5 6.5h.01" />
      <path d="M4.5 12h.01" />
      <path d="M4.5 17.5h.01" />
    </svg>
  );
}

export function GridViewIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M14.5 5 8 12l6.5 7" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M12 4v11" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M5 16.5v2A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-2" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M12 4v11" />
      <path d="M7.5 11.5 12 16l4.5-4.5" />
      <path d="M5 16.5v2A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-2" />
    </svg>
  );
}

export function ReelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="7.5" r="1.6" fill="currentColor" />
      <circle cx="16" cy="14.5" r="1.6" fill="currentColor" />
      <circle cx="8" cy="14.5" r="1.6" fill="currentColor" />
    </svg>
  );
}
