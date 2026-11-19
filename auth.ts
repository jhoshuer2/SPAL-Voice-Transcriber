import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { migrateOwner } from "@/lib/manifest";

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
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email;
      if (profile?.name) token.name = profile.name;
      if (profile?.picture) token.picture = profile.picture as string;
      return token;
    },
    async session({ session, token }) {
      if (token.email) session.user.email = token.email;
      if (token.picture) session.user.image = token.picture as string;
      return session;
    },
  },
});
