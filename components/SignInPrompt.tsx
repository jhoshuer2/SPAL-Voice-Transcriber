"use client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.41 3.62v3.01h3.85c2.25-2.07 3.55-5.14 3.55-8.66Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.91-2.92l-3.85-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.76-2.1-6.71-4.93H1.3v3.1C3.26 21.3 7.3 24 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.29A7.14 7.14 0 0 1 4.9 12c0-.8.14-1.57.39-2.29V6.6H1.3A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.3 5.4l3.99-3.11Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.23 0 12 0 7.3 0 3.26 2.7 1.3 6.6l3.99 3.11C6.24 6.88 8.88 4.75 12 4.75Z" />
    </svg>
  );
}

export type SignInPromptKind = "idle" | "download";

const COPY: Record<SignInPromptKind, { title: string; body: string }> = {
  idle: {
    title: "Keep this around?",
    body: "Your files are saved to this browser for now. Sign in with Google to keep your library across visits and devices.",
  },
  download: {
    title: "Got your transcript — keep the rest too?",
    body: "This library only sticks around on this browser. Sign in with Google so the rest of your files and transcripts are safe if you clear your browser or switch devices.",
  },
};

export function SignInPrompt({
  kind,
  onDismiss,
}: {
  kind: SignInPromptKind;
  onDismiss: () => void;
}) {
  const copy = COPY[kind];
  return (
    <div className="signin-toast" role="dialog" aria-label="Sign in to save your library">
      <button type="button" className="signin-toast__close" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
      <p className="signin-toast__title">{copy.title}</p>
      <p className="signin-toast__body">{copy.body}</p>
      <a href="/signin" className="btn btn--amber signin-toast__btn">
        <GoogleIcon />
        Sign in with Google
      </a>
    </div>
  );
}
