import { redirect } from "next/navigation";
import { GalleryEditor } from "@/components/gallery-editor";
import { config } from "@/lib/config";
import { getGitHub } from "@/lib/github/client";
import { getGallery } from "@/lib/github/gallery";

// The gallery should always reflect the latest commit, never a cached render.
export const dynamic = "force-dynamic";

function statusOf(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
}

export default async function Home() {
  const ctx = await getGitHub();
  if (!ctx) redirect("/login");

  try {
    const gallery = await getGallery(ctx.octokit, ctx.repo);
    return (
      <GalleryEditor initialItems={gallery.items} login={ctx.login} liveUrl={config.siteUrl} />
    );
  } catch (err) {
    if (statusOf(err) === 401) redirect("/login");
    const message =
      statusOf(err) === 404
        ? `Die Datei ${config.galleryDataPath} wurde im Repository nicht gefunden.`
        : statusOf(err) === 403
          ? `Kein Zugriff auf ${config.repo.owner}/${config.repo.name}. Fehlt die Schreibberechtigung?`
          : err instanceof Error
            ? err.message
            : "Die Galerie konnte nicht geladen werden.";

    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold">Galerie nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </main>
    );
  }
}
