import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { db } from './_db.ts';

const dir = fileURLToPath(new URL('.', import.meta.url));
const postsDir = join(dir, '../content/posts');

interface PostMeta {
  title: string;
  date: Date | string;
  auteurs: string[];
  tags: string[];
  link: string;
  stepsName: string[];
  stepsDate: string[];
  stepsStatus: string[];
  draft?: boolean;
}

function parseFrontmatter(content: string): PostMeta | null {
  const match = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+/);
  if (!match) return null;
  return parseToml(match[1]) as unknown as PostMeta;
}

function slugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '');
}

function proposalNum(slug: string): number {
  const m = slug.match(/n-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function proposalTitle(title: string): string {
  return title.includes(' - N° ') ? title.split(' - N° ')[0] : title;
}

function dateStr(raw: Date | string | undefined): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  return String(raw);
}

const insertArticle = db.prepare(
  `INSERT OR IGNORE INTO articles (slug, titre, titre_court, numero_proposition, date, lien, clean_authors)
   VALUES (?, ?, ?, ?, ?, ?, 0)`,
);
const insertTag = db.prepare(`INSERT OR IGNORE INTO article_tags (article_slug, tag) VALUES (?, ?)`);
const insertEtape = db.prepare(
  `INSERT OR IGNORE INTO article_etapes (article_slug, ordre, nom, date, statut) VALUES (?, ?, ?, ?, ?)`,
);
const insertAuteur = db.prepare(
  `INSERT OR IGNORE INTO article_auteurs (article_slug, ordre, nom_brut) VALUES (?, ?, ?)`,
);

const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
let added = 0;
let skipped = 0;

for (const filename of files) {
  const slug = slugFromFilename(filename);
  const exists = db.prepare('SELECT slug FROM articles WHERE slug = ?').get(slug);
  if (exists) {
    skipped++;
    continue;
  }

  const raw = readFileSync(join(postsDir, filename), 'utf-8');
  const meta = parseFrontmatter(raw);
  if (!meta) {
    console.warn(`Skipping ${filename}: no frontmatter`);
    continue;
  }

  const titre = meta.title ?? slug;
  insertArticle.run(slug, titre, proposalTitle(titre), proposalNum(slug), dateStr(meta.date), meta.link ?? null);

  for (const tag of meta.tags ?? []) {
    insertTag.run(slug, tag);
  }

  const names = meta.stepsName ?? [];
  const dates = meta.stepsDate ?? [];
  const statuts = meta.stepsStatus ?? [];
  for (let i = 0; i < names.length; i++) {
    insertEtape.run(slug, i, names[i] ?? null, dates[i] ?? null, statuts[i] ?? null);
  }

  for (let i = 0; i < (meta.auteurs ?? []).length; i++) {
    insertAuteur.run(slug, i, meta.auteurs[i]);
  }

  added++;
}

console.log(`Articles : ${added} added, ${skipped} already present`);
