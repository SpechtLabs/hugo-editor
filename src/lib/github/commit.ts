import "server-only";
import type { Octokit } from "@octokit/rest";

/**
 * One atomic commit, many file changes. Built on the Git Data API (ref → base tree
 * → blobs → tree → commit → move ref) so a single user action — even "upload this
 * photo AND add it to the gallery" — lands as one commit with no half-applied state.
 * Handles text and binary (base64) content, and deletions (tree entry with sha=null).
 */

export type FileChange =
  | { path: string; content: string; encoding: "utf-8" | "base64" }
  | { path: string; delete: true };

export interface CommitTarget {
  owner: string;
  name: string;
  branch: string;
}

export interface CommitResult {
  commitSha: string;
  commitUrl: string;
}

function isDelete(change: FileChange): change is { path: string; delete: true } {
  return "delete" in change && change.delete === true;
}

async function attempt(
  octokit: Octokit,
  target: CommitTarget,
  message: string,
  changes: FileChange[],
): Promise<CommitResult> {
  const { owner, name: repo, branch } = target;

  const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const parentSha = ref.data.object.sha;
  const parentCommit = await octokit.git.getCommit({ owner, repo, commit_sha: parentSha });

  const tree = await Promise.all(
    changes.map(async (change) => {
      if (isDelete(change)) {
        return { path: change.path, mode: "100644" as const, type: "blob" as const, sha: null };
      }
      const blob = await octokit.git.createBlob({
        owner,
        repo,
        content: change.content,
        encoding: change.encoding,
      });
      return {
        path: change.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.data.sha,
      };
    }),
  );

  const newTree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: parentCommit.data.tree.sha,
    tree,
  });

  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.data.sha,
    parents: [parentSha],
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
  });

  return { commitSha: commit.data.sha, commitUrl: commit.data.html_url };
}

/** Returns true for the "the branch moved under us" conflict from updateRef. */
function isFastForwardConflict(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 422 || status === 409;
}

export async function commitChanges(
  octokit: Octokit,
  target: CommitTarget,
  message: string,
  changes: FileChange[],
): Promise<CommitResult> {
  if (changes.length === 0) throw new Error("commitChanges called with no changes");
  try {
    return await attempt(octokit, target, message, changes);
  } catch (err) {
    // Single retry against a freshly fetched tip — covers the rare case where the
    // branch advanced between read and update (we serialize actions, so this is rare).
    if (isFastForwardConflict(err)) {
      return await attempt(octokit, target, message, changes);
    }
    throw err;
  }
}
