import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Searcher } from 'fast-fuzzy';
import { db } from './_db.ts';

const dir = fileURLToPath(new URL('.', import.meta.url));
const postsDir = join(dir, '../../content/posts');

const MATCH_THRESHOLD = 0.85;

interface Depute { id: string; nom: string; prenom: string }
interface ArticleRow { slug: string }
interface AuteurRow { ordre: number; nom_brut: string }

const deputes = db.prepare('SELECT id, nom, prenom FROM deputes WHERE retire = 0').all() as unknown as Depute[];

// Index for fast-fuzzy: search by "prenom nom" and "nom prenom"
type SearchItem = { id: string; canonical: string };
const candidates: SearchItem[] = deputes.flatMap(d => [
  { id: d.id, canonical: `${d.prenom} ${d.nom}` },
  { id: d.id, canonical: `${d.nom} ${d.prenom}` },
]);
const searcher = new Searcher(candidates, {
  keySelector: item => item.canonical,
  returnMatchData: true,
});

function canonicalName(id: string): string {
  const d = deputes.find(dep => dep.id === id)!;
  return `${d.prenom} ${d.nom}`;
}

const updateAuteur = db.prepare(
  `UPDATE article_auteurs SET nom_brut = ?, depute_id = ? WHERE article_slug = ? AND ordre = ?`
);
const markClean = db.prepare(
  `UPDATE articles SET clean_authors = 1 WHERE slug = ?`
);

const dirty = db.prepare('SELECT slug FROM articles WHERE clean_authors = 0').all() as unknown as ArticleRow[];

let totalReplacements = 0;
let articlesProcessed = 0;

for (const { slug } of dirty) {
  const filepath = join(postsDir, `${slug}.md`);
  let content: string;
  try {
    content = readFileSync(filepath, 'utf-8');
  } catch {
    console.warn(`File not found: ${slug}.md — skipping`);
    continue;
  }

  const auteurs = db.prepare(
    'SELECT ordre, nom_brut FROM article_auteurs WHERE article_slug = ? ORDER BY ordre'
  ).all(slug) as unknown as AuteurRow[];

  const replacements: { original: string; canonical: string; score: number }[] = [];

  for (const auteur of auteurs) {
    const results = searcher.search(auteur.nom_brut);
    if (results.length === 0) continue;

    const best = results[0];
    // fast-fuzzy with returnMatchData returns { item, score }
    const match = best as unknown as { item: SearchItem; score: number };
    if (match.score < MATCH_THRESHOLD) continue;

    const canonical = canonicalName(match.item.id);
    if (canonical === auteur.nom_brut) {
      // Already clean — just link the depute_id
      updateAuteur.run(auteur.nom_brut, match.item.id, slug, auteur.ordre);
      continue;
    }

    replacements.push({ original: auteur.nom_brut, canonical, score: match.score });
    updateAuteur.run(canonical, match.item.id, slug, auteur.ordre);
  }

  if (replacements.length > 0) {
    // Replace the auteurs array in the .md frontmatter
    const newNames = (
      db.prepare('SELECT nom_brut FROM article_auteurs WHERE article_slug = ? ORDER BY ordre')
        .all(slug) as { nom_brut: string }[]
    ).map(r => (r as unknown as { nom_brut: string }).nom_brut);

    const newLine = `auteurs = [${newNames.map(n => `"${n}"`).join(',')}]`;
    content = content.replace(/^auteurs = \[.*\]$/m, newLine);
    writeFileSync(filepath, content, 'utf-8');

    console.log(`\n${slug}`);
    for (const r of replacements) {
      console.log(`  "${r.original}" → "${r.canonical}" (${(r.score * 100).toFixed(0)}%)`);
    }
    totalReplacements += replacements.length;
  }

  markClean.run(slug);
  articlesProcessed++;
}

console.log(`\n── Summary ──`);
console.log(`Articles processed : ${articlesProcessed}`);
console.log(`Replacements made  : ${totalReplacements}`);
