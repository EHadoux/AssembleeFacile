import { load } from 'cheerio';
import cliProgress from 'cli-progress';
import { Searcher } from 'fast-fuzzy';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './_db.ts';

const xmlPath = process.argv[2];
if (!xmlPath) {
  console.error('Usage: tsx scripts/import-declarations.ts <path-to-declarations.xml>');
  process.exit(1);
}

const dir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = join(dir, '../assets/declarations/deputes');

const MATCH_THRESHOLD = 0.85;

interface Depute {
  id: string;
  nom: string;
  prenom: string;
}

const deputes = db.prepare('SELECT id, nom, prenom FROM deputes WHERE retire = 0').all() as unknown as Depute[];

type SearchItem = { id: string; canonical: string };
const candidates: SearchItem[] = deputes.flatMap((d) => [
  { id: d.id, canonical: `${d.prenom} ${d.nom}` },
  { id: d.id, canonical: `${d.nom} ${d.prenom}` },
]);
const searcher = new Searcher(candidates, {
  keySelector: (item) => item.canonical,
  returnMatchData: true,
});

function findDeputeId(nom: string, prenom: string): string | null {
  const fullName = `${prenom} ${nom}`.trim();
  const results = searcher.search(fullName);
  if (results.length === 0) return null;
  const best = results[0] as unknown as { item: SearchItem; score: number };
  if (best.score < MATCH_THRESHOLD) return null;
  return best.item.id;
}

const xmlContent = readFileSync(xmlPath, 'utf-8');
const $ = load(xmlContent, { xmlMode: true });

const declarations = $('declaration').toArray();

const bar = new cliProgress.SingleBar(
  { format: '{bar} {percentage}% | {value}/{total} | ETA: {eta}s' },
  cliProgress.Presets.shades_classic,
);
bar.start(declarations.length, 0);

let totalDeputes = 0;
let totalDeclarationsEcrites = 0;
let totalFichiersCreés = 0;
let totalDuplicates = 0;
let totalUnmatched = 0;

for (const el of declarations) {
  bar.increment();

  const label = $(el).find('general > mandat > label').first().text().trim();
  if (label !== 'Député ou sénateur') continue;

  totalDeputes++;

  const nom = $(el).find('general > declarant > nom').first().text().trim();
  const prenom = $(el).find('general > declarant > prenom').first().text().trim();
  const uuid = $(el).find('uuid').first().text().trim();

  const deputeId = findDeputeId(nom, prenom);
  if (!deputeId) {
    totalUnmatched++;
    continue;
  }

  const filePath = join(outputDir, `${deputeId}.xml`);
  const declarationXml = $.xml($(el));

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    if (existing.includes(uuid)) {
      totalDuplicates++;
      continue;
    }
    appendFileSync(filePath, '\n' + declarationXml, 'utf-8');
  } else {
    writeFileSync(filePath, declarationXml, 'utf-8');
    totalFichiersCreés++;
  }

  totalDeclarationsEcrites++;
}

bar.stop();

console.log('\n── Summary ──');
console.log(`Déclarations lues        : ${declarations.length}`);
console.log(`Déclarations de députés  : ${totalDeputes}`);
console.log(`Déclarations écrites     : ${totalDeclarationsEcrites}`);
console.log(`Fichiers uniques créés   : ${totalFichiersCreés}`);
console.log(`Doublons ignorés         : ${totalDuplicates}`);
console.log(`Non matchés (ignorés)    : ${totalUnmatched}`);
