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
  providers: [Google],
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
