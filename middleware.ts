import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Everything in this app is one person's private library. Gate all of
// it behind a Google session except the sign-in page itself and the
// NextAuth routes that handle the OAuth handshake.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = pathname.startsWith("/api/auth") || pathname === "/signin";
  if (isPublic || req.auth) return;

  // API routes get a JSON 401 — a redirect would hand a fetch() caller
  // an HTML sign-in page where it expects JSON. The route handlers also
  // check auth() themselves; this just fails fast.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const signInUrl = new URL("/signin", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  // Run on everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
