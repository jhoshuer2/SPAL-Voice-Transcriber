import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { migrateOwner } from "@/lib/manifest";
import { getCalendarAccount, saveCalendarAccount } from "@/lib/calendar";

// No database adapter on purpose, matching the rest of this app's
// "no database unless we need one" stance — sessions are a signed JWT
// cookie. Google's own account is the identity provider; this app
// just needs to know who's signed in well enough to scope the job
// manifest (lib/manifest.ts) to one owner at a time.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Explicit on purpose: Auth.js v5's Google() auto-detects env vars
    // named AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET by default, which isn't
    // the GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET naming used elsewhere
    // in this project (and in the README/.env.example). Left implicit,
    // this silently sent no client_id to Google at all — which Google
    // reports back as "Error 401: invalid_client, OAuth client was not
    // found" since there's no client with an empty/undefined id.
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ profile }) {
      // Sign-in is optional, so by the time someone does it they may
      // already have an anonymous library tied to their browser
      // cookie. Fold it into their account rather than orphaning it.
      try {
        const anonId = cookies().get("anon_id")?.value;
        if (anonId && profile?.email) {
          await migrateOwner(`anon:${anonId}`, `email:${profile.email}`);
        }
      } catch {
        // Best effort — never block sign-in over this.
      }
      return true;
    },
    async jwt({ token, profile, account }) {
      if (profile?.email) token.email = profile.email;
      if (profile?.name) token.name = profile.name;
      if (profile?.picture) token.picture = profile.picture as string;

      // `account` is only present on the sign-in request itself (not on
      // later JWT refreshes). When someone's gone through the "Connect
      // calendar" flow, this is the one moment we see the refresh token
      // — there's no DB adapter to persist it for us, so stash it in
      // our own manifest so a cron job can use it independent of this
      // browser session ever coming back.
      if (account?.scope?.includes("calendar") && profile?.email) {
        try {
          const ownerId = `email:${profile.email}`;
          // Google only sends a refresh_token on the first consent (or
          // when we force prompt=consent) — reuse the one we already
          // have on file rather than overwrite it with nothing.
          const existing = await getCalendarAccount(ownerId);
          await saveCalendarAccount({
            ownerId,
            email: profile.email,
            provider: "google",
            refreshToken: account.refresh_token || existing?.refreshToken || "",
            accessToken: account.access_token || "",
            accessTokenExpiresAt: account.expires_at
              ? new Date(account.expires_at * 1000).toISOString()
              : new Date(Date.now() + 3600_000).toISOString(),
            connectedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error("[auth] failed to save calendar account", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.email) session.user.email = token.email;
      if (token.picture) session.user.image = token.picture as string;
      return session;
    },
  },
});
