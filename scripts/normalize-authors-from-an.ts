import { load } from 'cheerio';
import { db } from './_db.ts';

const LIST_URL =
  'https://www2.assemblee-nationale.fr/documents/liste/(ajax)/1/(offset)/0/(limit)/10000/(type)/propositions-loi/(legis)/17/(no_margin)/false';

const TEXT_BASE = 'https://www.assemblee-nationale.fr/dyn/17/textes/l17b';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  Referer: 'http://www.google.com/',
};

interface ArticleRow {
  slug: string;
}

interface DeputeRow {
  id: string;
  nom: string;
  prenom: string;
}

interface AnActeur {
  acteur?: { acteurRef?: string };
  dateRetraitCosignature?: string | Record<string, never>;
}

interface AnJson {
  auteurs?: { auteur?: AnActeur | AnActeur[] };
  coSignataires?: { coSignataire?: AnActeur | AnActeur[] };
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

const selectArticle = db.prepare(
  'SELECT slug FROM articles WHERE numero_proposition = ? AND authors_from_an = 0',
);
const selectDepute = db.prepare('SELECT id, nom, prenom FROM deputes WHERE id = ?');
const deleteAuteurs = db.prepare('DELETE FROM article_auteurs WHERE article_slug = ?');
const insertAuteur = db.prepare(
  'INSERT INTO article_auteurs (article_slug, ordre, nom_brut, depute_id, role) VALUES (?, ?, ?, ?, ?)',
);
const markDone = db.prepare('UPDATE articles SET authors_from_an = 1 WHERE slug = ?');

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

const listHtml = await fetchHtml(LIST_URL);
const $list = load(listHtml);
const items = $list('ul.liens-liste > li').toArray();

console.log(`Found ${items.length} items in list`);

let processed = 0;
let skipped = 0;
let errors = 0;

for (const li of items) {
  // Numero is in the pion{numero}.asp href, not in the dossier URL
  const allHrefs = $list(li).find('a').map((_, a) => $list(a).attr('href') ?? '').toArray();
  const pionHref = allHrefs.find((h) => /pion\d+\.asp/.test(h));
  if (!pionHref) continue;

  const match = pionHref.match(/pion(\d+)\.asp/);
  if (!match) continue;

  const numero = parseInt(match[1], 10);
  const row = selectArticle.get(numero) as ArticleRow | undefined;
  if (!row) {
    skipped++;
    continue;
  }

  const { slug } = row;
  const paddedNumero = String(numero).padStart(4, '0');
  const textUrl = `${TEXT_BASE}${paddedNumero}_proposition-loi`;

  try {
    const textHtml = await fetchHtml(textUrl);
    const $text = load(textHtml);

    const jsonHref = $text('a[title="Version opendata au JSON de la notice du document"]').attr('href');
    if (!jsonHref) {
      console.warn(`[${slug}] No opendata JSON link on text page`);
      errors++;
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const jsonUrl = jsonHref.startsWith('http')
      ? jsonHref
      : `https://www.assemblee-nationale.fr${jsonHref}`;

    const data = (await fetchJson(jsonUrl)) as AnJson;

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

    if (allRefs.length === 0) {
      console.warn(`[${slug}] No acteurRef found (may be a Sénat-transmitted text) — skipping`);
      errors++;
      await new Promise((r) => setTimeout(r, 2000));
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
      errors++;
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    deleteAuteurs.run(slug);
    for (let i = 0; i < deputes.length; i++) {
      const entry = deputes[i]!;
      const nomBrut = `${entry.depute.prenom} ${entry.depute.nom}`;
      insertAuteur.run(slug, i + 1, nomBrut, entry.depute.id, entry.role);
    }
    markDone.run(slug);

    const summary = deputes
      .map((d) => `${d!.depute.prenom} ${d!.depute.nom} (${d!.role})`)
      .join(', ');
    console.log(`[${slug}] ✓ ${summary}`);
    processed++;
  } catch (err) {
    console.error(`[${slug}] Error: ${err instanceof Error ? err.message : err}`);
    errors++;
  }

  await new Promise((r) => setTimeout(r, 2000));
}

console.log('\n── Summary ──');
console.log(`Processed : ${processed}`);
console.log(`Skipped   : ${skipped}`);
console.log(`Errors    : ${errors}`);
