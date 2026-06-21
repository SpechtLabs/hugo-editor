import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * GitHub OAuth, no database. The provider access token is what lets the editor
 * read and commit to the (private) website repo, so it's carried in the JWT and
 * surfaced on the session for server-side use.
 *
 * Tradeoff: with the JWT session strategy the session is also readable by the
 * signed-in user's own browser (via /api/auth/session). For this small,
 * single-tenant tool that's acceptable; switching to a GitHub App with
 * short-lived installation tokens would remove even that exposure if ever needed.
 */

function allowedLogins(): string[] {
  return (process.env.ALLOWED_GITHUB_LOGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      // `repo` → read/write the private website repo. `read:user` → the login
      // used by the allowlist below.
      authorization: { params: { scope: "repo read:user" } },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ profile }) {
      const allow = allowedLogins();
      // No allowlist configured → allow (keeps local dev frictionless).
      if (allow.length === 0) return true;
      const login = typeof profile?.login === "string" ? profile.login.toLowerCase() : "";
      return login !== "" && allow.includes(login);
    },
    jwt({ token, account, profile }) {
      if (account?.access_token) token.accessToken = account.access_token;
      if (profile?.login) token.login = profile.login as string;
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user.login = token.login;
      return session;
    },
  },
});
