# hugo-editor

A tiny WYSIWYG editor for a Hugo photo gallery. It lets a non-technical person upload
photos, drag them into order, edit captions, and delete entries — without ever touching
git, YAML, or a terminal. Every change is committed straight to the website's GitHub
repository, which triggers the site's normal build and republishes within a minute or two.

It was built for the gallery on [gold-specht.de](https://gold-specht.de) (a jewelry
business running on Hugo), but it's driven entirely by environment variables, so it works
against any Hugo site whose gallery is a YAML array of items in a data file.

There is no database and no separate backend service. The GitHub repo is the single source
of truth. The only server-side code is what has to be server-side: the OAuth secret and
read/write access to a private repo.

## How it works

```
Browser (the editor UI)
  pick a photo → crop / zoom / rotate (touch) → decode (incl. iPhone HEIC) → resize →
    re-encode as .webp (jpeg fallback on older iOS Safari), all client-side
  drag to reorder / edit caption / delete, with optimistic UI
        │
        ▼  Server Action (Next.js)
  the signed-in user's GitHub token (kept server-side) makes one atomic commit per action
        │
        ▼  GitHub Action on the website repo
  hugo --minify → upload to the host → live in ~1–2 min
```

The gallery lives in a single Hugo data file (for GoldSpecht: `data/de/portfolio.yml`) as a
YAML array. Display order is array order, so reordering photos is literally reordering that
array. Image files live under `static/images/`. Because the website repo is private, the
editor streams thumbnails through its own `/api/image` proxy using the signed-in user's
token rather than linking them directly.

## Stack

- Bun + Next.js 16 (App Router) + TypeScript, deployed on Vercel
- shadcn/ui + Tailwind v4
- Auth.js (GitHub OAuth) for sign-in and the repo token
- Octokit (GitHub Git Data API) for atomic commits
- `@dnd-kit` for drag-and-drop, `yaml` for surgical data-file edits, `heic-to` for iPhone photos
- Biome for lint/format, `bun test` for the data-file logic

Local tool versions (Bun, Node, the Vercel CLI, the linters) are pinned in `.mise.toml`, and
its tasks are what CI runs.

## Local development

You need [mise](https://mise.jdx.dev/). It provides Bun, Node, and the Vercel CLI at the
pinned versions.

```bash
mise install                 # installs the tools pinned in .mise.toml
cp .env.example .env.local   # then fill in the values (see below)
mise run dev                 # installs dependencies, serves http://localhost:3000
```

`mise run check` runs every gate CI runs: Biome, yamllint and actionlint, the type check,
the tests and the production build. `mise tasks` lists the single steps (`mise run test`,
`mise run lint`, `mise run fmt`, ...).

### Configuration

Copy `.env.example` to `.env.local` and fill it in.

1. Create a **GitHub OAuth App** (GitHub → Settings → Developer settings → OAuth Apps).
   Set the Authorization callback URL to `http://localhost:3000/api/auth/callback/github`
   for local dev and `https://edit.gold-specht.de/api/auth/callback/github` for production.
   Put the Client ID/secret in `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
2. Generate `AUTH_SECRET` with `mise exec -- bunx auth secret` (or `openssl rand -base64 33`).
3. List the GitHub logins allowed to sign in in `ALLOWED_GITHUB_LOGINS` (comma-separated).
   Anyone not on the list is rejected at sign-in, even though they'd still need write access
   to the repo to change anything.
4. The signing-in user needs **write/collaborator access** to the target repo.

The repo and gallery layout are configured with `GITHUB_REPO_*`, `GALLERY_DATA_PATH`,
`GALLERY_ITEMS_PATH`, `IMAGE_DIR`, and `IMAGE_PUBLIC_PREFIX`. Defaults target GoldSpecht.

## Deploying

The project is deployed on Vercel at `edit.gold-specht.de`. Set the same environment
variables in the Vercel project (Production and Preview), then push to `main`. With the
Vercel CLI you can also run `mise exec -- vercel` to link, `mise exec -- vercel env pull`
to sync env vars locally, and `mise exec -- vercel --prod` to deploy.

## Pointing it at another Hugo site

Set the `GITHUB_REPO_*` and gallery/image variables for the other repo. The editor assumes
the gallery is a YAML sequence reachable by a dotted key path (`GALLERY_ITEMS_PATH`, default
`portfolio.portfolio_item`) where each entry has `name`, `image`, `categories`, `content`,
and `link`. Anything else in the file is preserved untouched on every write.
