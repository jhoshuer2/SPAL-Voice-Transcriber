"use server";

import { signIn, signOut } from "@/auth";
import { getOwnerId } from "@/lib/owner";
import { removeCalendarAccount } from "@/lib/calendar";

export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}

// A normal sign-in only requests profile/email scope. Connecting the
// calendar re-runs Google's consent screen with the calendar.readonly
// scope added, plus access_type=offline + prompt=consent so Google
// actually hands back a refresh token (it only does that on a consent
// screen it's showing fresh — a silent re-auth would skip it).
export async function connectCalendarAction() {
  await signIn(
    "google",
    { redirectTo: "/?calendar=connected" },
    {
      scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
      access_type: "offline",
      prompt: "consent",
    },
  );
}

export async function disconnectCalendarAction() {
  const ownerId = await getOwnerId();
  await removeCalendarAccount(ownerId);
}
