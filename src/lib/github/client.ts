import "server-only";
import { Octokit } from "@octokit/rest";
import { auth } from "@/auth";
import { config } from "@/lib/config";

/** Thrown when there's no signed-in user (or no usable token) for a server action. */
export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export interface GitHubContext {
  octokit: Octokit;
  login: string | undefined;
  repo: { owner: string; name: string; branch: string };
}

/**
 * Build an Octokit from the current session's GitHub token, or null if there's no
 * session. Use {@link requireGitHub} in server actions where a session is required.
 */
export async function getGitHub(): Promise<GitHubContext | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  return {
    octokit: new Octokit({ auth: session.accessToken }),
    login: session.user?.login,
    repo: { owner: config.repo.owner, name: config.repo.name, branch: config.repo.branch },
  };
}

export async function requireGitHub(): Promise<GitHubContext> {
  const ctx = await getGitHub();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}
