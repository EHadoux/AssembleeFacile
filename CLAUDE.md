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
npm run db:update-etapes <path/to/Dossiers_Legislatifs.json.zip>  # Update étapes parlementaires in markdown frontmatter (étapes are read from markdown, not DB — no reseed needed after)
npm run db:link-dossiers <path/to/Dossiers_Legislatifs.json.zip>  # Populate articles.dossier_ref in DB (prerequisite for import-scrutins)
npm run db:import-scrutins <path/to/Dossiers_Legislatifs.json.zip> <path/to/Scrutins.json.zip>  # Import vote data into scrutins tables
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
- Schema: `db/001_init.sql` + migrations `002`, `003`, `004`
- Used **only at build time** via `$lib/server/queries.ts` (Node's built-in `node:sqlite`)
- `scrutins`, `scrutin_votes_groupes`, `scrutin_votes_deputes` — vote data imported by `scripts/import-scrutins.ts`. Requires `articles.dossier_ref` to be populated first (`db:link-dossiers`). Group colour resolution uses `groupe_abrev` matched dynamically via the deputes table during import; unresolved organe_refs are stored raw.

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

### Étapes parlementaires — mise à jour depuis l'open data AN

`scripts/update-etapes.ts` lit le ZIP `Dossiers_Legislatifs.json.zip` (open data AN) et met à jour les champs `stepsName`, `stepsDate`, `stepsStatus` dans le frontmatter TOML de chaque post. Remplace entièrement le scraping n8n.

**Matching** : `link` frontmatter → slug final de l'URL → `titreDossier.titreChemin` dans le JSON. Indexer **tous** les fichiers (pas seulement `legislature == "17"`) car les dossiers multi-législatures sont archivés sous leur UID d'origine (ex: L13) mais contiennent des étapes L17.

**Structure JSON `dossierParlementaire`** :
- Top-level `actesLegislatifs` : codes `AN1`, `SN1`, `AN2`, `SN2`, `ANNLEC`, `SNNLEC`, `ANLDEF`, `CMP`, `CC`, `PROM`
- Dans chaque lecture : `{CODE}-DEPOT` (date dépôt), `{CODE}-COM-FOND-SAISIE` (renvoi en commission + organeRef), `{CODE}-DEBATS-SEANCE` (séances plénières), `{CODE}-DEBATS-DEC` (décision/vote avec `statutConclusion.libelle`)
- Pour `CMP` : décision dans `CMP-DEC` (pas `CMP-DEBATS-AN-DEC` qui est un vote intermédiaire)
- Pour `CC` : décision dans `CC-CONCLUSION`
- Pour `PROM` : date dans `PROM-PUB`

**Règles d'extraction** :
- Date de lecture = date du `{CODE}-DEPOT` (correspond à ce qu'affiche le site officiel)
- "Première lecture" n'est ajoutée que si `{CODE}-DEBATS` existe (sinon seul "Dépôt" + "Renvoi en commission" apparaissent)
- "Renvoi en commission" toujours ajouté si `{CODE}-COM-FOND-SAISIE` présent ; commission résolue via `organeRef`

**Codes organeRef des commissions permanentes** (L17 AN) : `PO59051`=Lois, `PO59048`=Finances, `PO59047`=Affaires étrangères, `PO59046`=Défense, `PO419604`=Affaires culturelles, `PO419610`=Affaires économiques, `PO419865`=Développement durable, `PO420120`=Affaires sociales. Codes `PO211xxx`/`PO516xxx` = commissions du Sénat.

### OG image generation

Static PNG images prerendered at build time via `satori` + `@resvg/resvg-js`. Routes live under `src/routes/og/`. Fonts loaded from `@fontsource/dm-sans` (WOFF1 — Google Fonts serves WOFF2 which satori rejects). See **`docs/ogimage.md`** for full quirks: oklch colour conversion for SVG, font format constraints, number formatting.

### Name normalisation / author matching

Author names in markdown frontmatter were generated by an LLM and may differ from canonical CSV/DB names. Matching uses `normalizeForLookup` (strip accents, lowercase, collapse spaces) with a three-pass fallback: exact full name → both nom+prénom present → nom only.
