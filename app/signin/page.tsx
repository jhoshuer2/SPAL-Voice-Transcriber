import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { ReelIcon } from "@/components/icons";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.41 3.62v3.01h3.85c2.25-2.07 3.55-5.14 3.55-8.66Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.91-2.92l-3.85-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.76-2.1-6.71-4.93H1.3v3.1C3.26 21.3 7.3 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29A7.14 7.14 0 0 1 4.9 12c0-.8.14-1.57.39-2.29V6.6H1.3A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.3 5.4l3.99-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.23 0 12 0 7.3 0 3.26 2.7 1.3 6.6l3.99 3.11C6.24 6.88 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await auth();
  if (session) redirect(searchParams.callbackUrl || "/");

  return (
    <main className="signin-shell">
      <div className="signin-card">
        <div className="brand__mark" style={{ margin: "0 auto 18px" }}>
          <ReelIcon />
        </div>
        <h1 className="signin-title">Spool</h1>
        <p className="signin-sub">
          Sign in to see your library — audio of any length, transcribed and kept private to you.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: searchParams.callbackUrl || "/" });
          }}
        >
          <button type="submit" className="btn btn--amber signin-btn">
            <GoogleIcon />
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
