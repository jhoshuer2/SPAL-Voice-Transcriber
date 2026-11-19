import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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
