import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { db } from './_db.ts';

const zipPath = process.argv[2];
if (!zipPath || !existsSync(zipPath)) {
  console.error('Usage: tsx scripts/normalize-authors-zip.ts <path-to-Dossiers_Legislatifs.json.zip>');
  process.exit(1);
}

interface DocumentJson {
  auteurs?: { auteur?: AnActeur | AnActeur[] };
  coSignataires?: { coSignataire?: AnActeur | AnActeur[] };
}

interface AnActeur {
  acteur?: { acteurRef?: string };
  dateRetraitCosignature?: string | null | Record<string, never>;
}

interface ArticleRow {
  slug: string;
  numero_proposition: number;
}

interface DeputeRow {
  id: string;
  nom: string;
  prenom: string;
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

async function patchAuteursFrontmatter(mdPath: string, names: string[]): Promise<void> {
  const content = await fs.readFile(mdPath, 'utf-8');
  const line = `auteurs = [${names.map((n) => `"${n}"`).join(',')}]`;
  let updated: string;
  if (/^auteurs\s*=\s*\[/m.test(content)) {
    updated = content.replace(/^auteurs\s*=\s*\[.*\]$/m, line);
  } else {
    updated = content.replace(/^\+\+\+\n/, `+++\n${line}\n`);
  }
  await fs.writeFile(mdPath, updated, 'utf-8');
}

const selectDepute = db.prepare('SELECT id, nom, prenom FROM deputes WHERE id = ?');
const deleteAuteurs = db.prepare('DELETE FROM article_auteurs WHERE article_slug = ?');
const insertAuteur = db.prepare(
  'INSERT INTO article_auteurs (article_slug, ordre, nom_brut, depute_id, role) VALUES (?, ?, ?, ?, ?)',
);
const markDone = db.prepare('UPDATE articles SET authors_from_an = 1 WHERE slug = ?');

const tmpDir = mkdtempSync(join(tmpdir(), 'normalize-authors-zip-'));

let processed = 0;
let skippedNotInZip = 0;
let skippedUnknownRef = 0;
let errors = 0;

try {
  console.log('Extracting document JSON files from ZIP...');
  execSync(`unzip -q -o "${zipPath}" "json/document/PIONANR5L17B*.json" -d "${tmpDir}"`);

  const docDir = join(tmpDir, 'json/document');

  console.log('Indexing documents...');
  const docMap = new Map<number, DocumentJson>();
  for (const fname of readdirSync(docDir)) {
    const num = parseInt(fname.replace('PIONANR5L17B', '').replace('.json', ''), 10);
    if (isNaN(num)) continue;
    const data = JSON.parse(readFileSync(join(docDir, fname), 'utf-8')) as DocumentJson;
    docMap.set(num, data);
  }
  console.log(`Indexed ${docMap.size} documents`);

  const articles = db
    .prepare('SELECT slug, numero_proposition FROM articles WHERE authors_from_an = 0')
    .all() as unknown as ArticleRow[];
  console.log(`Processing ${articles.length} articles with authors_from_an = 0...`);

  for (const { slug, numero_proposition } of articles) {
    const data = docMap.get(numero_proposition);
    if (!data) {
      console.log(`[${slug}] not in ZIP yet — skipping`);
      skippedNotInZip++;
      continue;
    }

    try {
      const auteurRefs = toArray(data.auteurs?.auteur)
        .map((a) => a.acteur?.acteurRef)
        .filter((ref): ref is string => !!ref)
        .map((ref) => ({ ref, role: 'auteur' as const }));

      const coSignRefs = toArray(data.coSignataires?.coSignataire)
        .filter((a) => typeof a.dateRetraitCosignature !== 'string')
        .map((a) => a.acteur?.acteurRef)
        .filter((ref): ref is string => !!ref)
        .map((ref) => ({ ref, role: 'cosignataire' as const }));

      const allRefs = [...auteurRefs, ...coSignRefs];

      if (auteurRefs.length === 0) {
        const mdPath = fileURLToPath(new URL(`../content/posts/${slug}.md`, import.meta.url));
        await patchAuteursFrontmatter(mdPath, []);
        deleteAuteurs.run(slug);
        markDone.run(slug);
        console.log(`[${slug}] No auteur acteurRef — cleared authors and marked normalised`);
        processed++;
        continue;
      }

      const deputes = allRefs.map(({ ref, role }) => {
        const depute = selectDepute.get(ref) as DeputeRow | undefined;
        return depute ? { depute, role } : null;
      });

      if (deputes.some((d) => d === null)) {
        const missing = allRefs
          .filter((_, i) => deputes[i] === null)
          .map((r) => r.ref)
          .join(', ');
        console.warn(`[${slug}] Unknown acteurRef(s): ${missing} — skipping`);
        skippedUnknownRef++;
        continue;
      }

      deleteAuteurs.run(slug);
      const names: string[] = [];
      for (let i = 0; i < deputes.length; i++) {
        const entry = deputes[i]!;
        const nomBrut = `${entry.depute.prenom} ${entry.depute.nom}`;
        insertAuteur.run(slug, i + 1, nomBrut, entry.depute.id, entry.role);
        names.push(nomBrut);
      }
      markDone.run(slug);

      const mdPath = fileURLToPath(new URL(`../content/posts/${slug}.md`, import.meta.url));
      await patchAuteursFrontmatter(mdPath, names);

      const summary = deputes.map((d) => `${d!.depute.prenom} ${d!.depute.nom} (${d!.role})`).join(', ');
      console.log(`[${slug}] ✓ ${summary}`);
      processed++;
    } catch (err) {
      console.error(`[${slug}] Error: ${err instanceof Error ? err.message : err}`);
      errors++;
    }
  }

  console.log('\n── Summary ──');
  console.log(`Processed              : ${processed}`);
  console.log(`Skipped (not in ZIP)   : ${skippedNotInZip}`);
  console.log(`Skipped (unknown ref)  : ${skippedUnknownRef}`);
  console.log(`Errors                 : ${errors}`);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
