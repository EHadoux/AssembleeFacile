/**
 * Repairs frontmatter `auteurs = [...]` for articles where the DB (article_auteurs)
 * and the markdown file are out of sync. Only touches articles with authors_from_an = 1
 * (i.e. already processed by normalize-authors-zip / normalize-authors-from-an).
 *
 * The DB is the source of truth: entries with role IS NOT NULL, ordered by ordre.
 */
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { db } from './_db.ts';

interface ArticleRow {
  slug: string;
}

interface SignataireRow {
  nom_brut: string;
}

const selectArticles = db.prepare(
  'SELECT slug FROM articles WHERE authors_from_an = 1 ORDER BY slug',
);

const selectSignataires = db.prepare(`
  SELECT nom_brut
  FROM article_auteurs
  WHERE article_slug = ? AND role IS NOT NULL
  ORDER BY ordre ASC
`);

async function patchAuteursFrontmatter(mdPath: string, names: string[]): Promise<void> {
  const content = await fs.readFile(mdPath, 'utf-8');
  const line = `auteurs = [${names.map((n) => `"${n}"`).join(',')}]`;
  let updated: string;
  if (/^auteurs\s*=\s*\[/m.test(content)) {
    updated = content.replace(/^auteurs\s*=\s*\[.*\]$/m, line);
  } else {
    updated = content.replace(/^\+\+\+\n/, `+++\n${line}\n`);
  }
  if (updated !== content) {
    await fs.writeFile(mdPath, updated, 'utf-8');
  }
}

function getFrontmatterNames(mdContent: string): string[] {
  const m = mdContent.match(/^auteurs\s*=\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return m[1].match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ?? [];
}

const articles = selectArticles.all() as unknown as ArticleRow[];
console.log(`Checking ${articles.length} articles with authors_from_an = 1...`);

let repaired = 0;
let skipped = 0;
let missing = 0;

for (const { slug } of articles) {
  const mdPath = fileURLToPath(new URL(`../content/posts/${slug}.md`, import.meta.url));

  let content: string;
  try {
    content = await fs.readFile(mdPath, 'utf-8');
  } catch {
    missing++;
    continue;
  }

  const dbNames = (selectSignataires.all(slug) as unknown as SignataireRow[]).map((r) => r.nom_brut);
  const frontmatterNames = getFrontmatterNames(content);

  // If the DB has no canonical signataires (cleared by normalize script for e.g. Sénat
  // president or unresolved refs), trust the existing frontmatter — don't overwrite with [].
  if (dbNames.length === 0 || dbNames.join('|') === frontmatterNames.join('|')) {
    skipped++;
    continue;
  }

  await patchAuteursFrontmatter(mdPath, dbNames);
  console.log(
    `[${slug}] repaired — was ${frontmatterNames.length} names, now ${dbNames.length}`,
  );
  repaired++;
}

console.log('\n── Summary ──');
console.log(`Repaired : ${repaired}`);
console.log(`Already OK : ${skipped}`);
console.log(`MD file not found : ${missing}`);
