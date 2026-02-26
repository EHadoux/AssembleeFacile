# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

**Assemblée Facile** is a public-interest static website that makes French parliamentary activity more accessible. It indexes hundreds of _propositions de loi_ (private members' bills) tabled at the Assemblée nationale (17th legislature), summarises each one in plain language, and organises them by theme, political group, and author (député). The goal is civic transparency: letting ordinary citizens quickly understand what their elected representatives are actually proposing.

## Commands

```bash
npm run dev           # Start dev server (Vite)
npm run build         # Full static build → build/
npm run preview       # Preview production build
npm run check         # TypeScript + Svelte type-checking

# Database seeding (run once, or to refresh)
npm run db:seed-deputes   # Seed députés from CSV into SQLite
npm run db:seed-articles  # Seed markdown posts into SQLite
npm run db:clean-authors  # Fuzzy-match and normalise author names in DB
```

## Architecture

This is a **fully static SvelteKit site** (adapter-static, `prerender = true` on the root layout). There is no runtime server — everything is pre-rendered at build time.

### Content pipeline

- `content/posts/*.md` — ~1000+ markdown files, one per _proposition de loi_. Frontmatter is **TOML** (not YAML), delimited by `+++`.
- `src/lib/content.ts` — **the sole file** using `import.meta.glob` for markdown. Parses metadata eagerly and raw text for excerpts. Exports `getAllPosts()`, `getPost()`, `slugify()`, etc. **Not in `$lib/server/`** — intentional, it's used in universal `+page.ts` loads.
- `src/routes/search.json/` — pre-generates a JSON search index consumed client-side by Fuse.js on `/search`.

### Database (SQLite)

`db/assemblee.db` is a SQLite file committed to the repo. It stores the relational data that markdown frontmatter cannot express cleanly:

- `groupes`, `deputes`, `articles`, `article_auteurs`, `article_tags`, `article_etapes`
- Schema: `db/001_init.sql`
- Used **only at build time** via `$lib/server/queries.ts` (Node's built-in `node:sqlite`)

### Data sources for député info

Two parallel sources exist; prefer the DB for detail pages:

- **CSV** (`assets/deputes-active.csv`) → `$lib/server/deputes.ts` — basic info (name, groupe, photo). Used for the post sidebar when the DB is unavailable.
- **SQLite DB** → `$lib/server/queries.ts` — richer info (scores, constituency, contact). Used for home page stats and député detail pages.

Deputy photos are loaded from `https://www2.assemblee-nationale.fr/static/tribun/17/photos/{id}.jpg` where `id = deputeId.replace('PA', '')`.

### Key lib modules

| Path                          | Role                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `$lib/content.ts`             | Markdown content API (universal, not server-only)                             |
| `$lib/server/queries.ts`      | SQLite queries (server-only)                                                  |
| `$lib/server/deputes.ts`      | CSV-based député lookup (server-only)                                         |
| `$lib/utils/normalize.ts`     | `normalizeForLookup()` — used both in server modules and in Svelte components |
| `$lib/utils/groupe-order.ts`  | `GROUPE_ORDER` array — political group display order                          |
| `$lib/server/groupes.ts`      | Groupe colour/name data                                                       |
| `$lib/server/declarations.ts` | XML parsing + snapshot reconstruction for HATVP declarations (server-only)    |
| `$lib/utils/declarations.ts`  | Formatting utilities for declarations display (client-safe)                   |

**Critical**: `$lib/utils/` exists specifically to hold utilities needed by Svelte components. Never move these back into `$lib/server/`.

> **Vite 6 + SvelteKit 2.15 gotcha**: any Svelte component (even transitively imported by a page) that imports a _runtime value_ (`const`, `function`) from `$lib/server/` will corrupt the entire client bundle and throw an "An impossible situation occurred" error on **all** pages — not just the one using the component. `import type` from server modules is safe (erased at build time). Pure utilities needed client-side must live in `$lib/utils/`.

### Routes

| Route             | Data source                                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| `/`               | `+page.server.ts` — paginated posts + home stats from DB                      |
| `/page/[page]`    | `+page.svelte` only — client-side pagination via URL param                    |
| `/posts/[slug]`   | `+page.server.ts` loads meta + député list; `+layout.server.ts` loads groupes |
| `/auteurs/[slug]` | `+page.server.ts` — author detail + DB-enriched député data                   |
| `/auteurs`        | `+page.server.ts` — full author list                                          |
| `/tags/[tag]`     | `+page.server.ts`                                                             |
| `/search`         | Client-only, fetches `/search.json` on mount                                  |

### Svelte 5 patterns used

- `$props()`, `$state()`, `$derived()`, `$effect.pre()` (runes mode)
- For mutable state arrays that reset on prop changes, use `$effect.pre` not `$state` initialisers
- UI components: bits-ui + shadcn-svelte convention under `$lib/components/ui/`
- **`\u00a0` escape gotcha**: JS Unicode escapes only work inside `{}` expressions or JS template literals. In raw HTML text nodes (outside `{}`), `\u00a0` renders literally as the 6 characters `\u00a0`. Use `&nbsp;` instead for non-breaking spaces in HTML text.

### Declarations of interest (HATVP)

Each député's author page (`/auteurs/[slug]`) has a **Profil / Déclarations d'intérêts** tab system. Declaration data comes from XML files in `assets/declarations/deputes/PA{id}.xml`, imported from the HATVP open data via `scripts/import-declarations.ts`.

Key points:

- XML files are **concatenated `<declaration>` fragments** (no root element) — the parser wraps them in `<root>` before passing to cheerio.
- `$lib/server/declarations.ts` implements the **snapshot reconstruction algorithm**: initial declarations replace everything, modificatives patch section-by-section. Absent sections in a modificative are carried forward unchanged.
- `loadDeclarations(deputeId)` returns `DeclarationSnapshot[]` (oldest first). Returns `[]` on missing/corrupt files — never breaks the build.
- The UI component `$lib/components/DeputeDeclarations.svelte` handles version navigation (prev/next) and renders 9 section types, hiding sections where `neant=true`.
- Formatting utilities (`formatAmount`, `formatPeriod`, `isPrivate`) live in `$lib/utils/declarations.ts` (client-safe, not `$lib/server/`).

### Name normalisation / author matching

Author names in markdown frontmatter were generated by an LLM and may differ from canonical CSV/DB names. Matching uses `normalizeForLookup` (strip accents, lowercase, collapse spaces) with a three-pass fallback: exact full name → both nom+prénom present → nom only.
