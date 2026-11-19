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
