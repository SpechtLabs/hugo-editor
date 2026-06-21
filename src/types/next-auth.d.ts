import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** GitHub OAuth access token (server-side use: reading/committing the repo). */
    accessToken?: string;
    user: { login?: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    login?: string;
  }
}
