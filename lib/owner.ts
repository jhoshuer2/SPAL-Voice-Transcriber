import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";

const ANON_COOKIE = "anon_id";

// Sign-in is optional. Everyone gets a private library from the first
// visit — signed-in people are scoped by email, everyone else by an
// anonymous cookie id handed out the first time they do anything. If
// they later sign in, lib/manifest.ts#migrateOwner folds that
// anonymous history into their account instead of losing it.
export async function getOwnerId(): Promise<string> {
  const session = await auth();
  if (session?.user?.email) return `email:${session.user.email}`;

  const jar = cookies();
  const existing = jar.get(ANON_COOKIE)?.value;
  if (existing) return `anon:${existing}`;

  const id = randomUUID();
  try {
    jar.set(ANON_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } catch {
    // cookies().set() only works inside a Route Handler or Server
    // Action; if this ever runs somewhere else, fail soft rather than
    // break the request — this visitor just won't persist a cookie.
  }
  return `anon:${id}`;
}

export function getAnonCookieValue(): string | undefined {
  return cookies().get(ANON_COOKIE)?.value;
}
