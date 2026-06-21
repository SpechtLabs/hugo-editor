<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# hugo-editor — project guide

A WYSIWYG editor for a Hugo photo gallery. A signed-in user uploads/reorders/edits/deletes
gallery entries; every action is one atomic git commit to the website's GitHub repo, which
rebuilds and republishes the site. No database, no separate backend — the repo is the only
store. See `README.md` for setup and the user-facing overview.

## Commands

Everything runs through mise (Bun, Node, Vercel CLI are pinned in `mise.toml`):

- `mise exec -- bun dev` — dev server
- `mise exec -- bun test` — data-file logic tests (`tests/portfolio.test.ts`)
- `mise exec -- bun run lint` / `bun run format` — Biome
- `mise exec -- bun run build` — production build

Install tools with `mise use <tool>@<version>`; never curl/brew/global-npm them.

## Architecture

- `src/lib/config.ts` — server-only, env-driven config (target repo, data-file path, image
  dirs). Everything is configurable so the editor isn't hardwired to one site.
- `src/lib/portfolio/` — the core, kept pure and unit-tested first:
  - `schema.ts` — zod types (`PortfolioItem`, `ItemForm`, `ItemPatch`, `IndexedItem`).
  - `yaml.ts` — text-in/text-out edits of the data file via the `yaml` **Document API** so
    untouched entries keep their exact formatting (minimal diffs).
  - `paths.ts` — pure mapping between YAML image value ↔ repo path ↔ public URL, plus slug
    and new-filename helpers.
  - `transform.ts` — client-safe array helpers (`collectCategories`, `isPermutation`).
- `src/lib/github/` — Octokit from the session token + an atomic `commitChanges` primitive
  (Git Data API: ref → tree → blob(s) → commit → update ref). One commit per user action.
- `src/lib/image/` — client-side decode (incl. HEIC) + resize + webp encode before upload.
- `src/auth.ts`, `src/middleware.ts`, `src/app/api/auth`, `src/app/login` — GitHub OAuth
  with an `ALLOWED_GITHUB_LOGINS` allowlist.
- `src/app/api/image/route.ts` — proxies private-repo images using the session token.
- `src/server/actions.ts` — Server Actions wiring UI → github layer.
- `src/components/` — the editor UI (dnd-kit grid, dialogs). `components/ui` is shadcn.

## Invariants — don't break these

- **Entries are addressed by array index, never by image path.** The real data references
  one photo from two different entries, so image is NOT unique. Mutations take an
  `expectImage` guard to detect a stale index and fail loudly. `reorderItems` only accepts a
  full permutation, so a reorder can never drop or duplicate an entry. There's a test for
  exactly this; keep it green.
- **Display order is array order.** No weights or sorting in the Hugo template.
- **Preserve unknown YAML keys and formatting.** Edit through the Document API, not a
  parse→object→stringify round-trip.
- **The token never reaches the client.** It lives in the Auth.js JWT and is used only in
  Server Actions / route handlers.

## Deploy loop

Push to the website repo's `main` → its GitHub Action (`hugo --minify` + StaticPages upload)
→ live in ~1–2 min. This editor itself deploys on Vercel at `edit.gold-specht.de`.
