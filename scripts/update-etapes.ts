import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const zipPath = process.argv[2];
if (!zipPath || !existsSync(zipPath)) {
  console.error('Usage: tsx scripts/update-etapes.ts <path-to-Dossiers_Legislatifs.json.zip>');
  process.exit(1);
}

const dir = fileURLToPath(new URL('.', import.meta.url));
const postsDir = join(dir, '../content/posts');

// --- Types ---

interface ActeLegislatif {
  codeActe: string;
  dateActe: string | null;
  organeRef?: string | null;
  actesLegislatifs?: { acteLegislatif: ActeLegislatif | ActeLegislatif[] } | null;
  statutConclusion?: { libelle: string } | null;
}

interface DossierParlementaire {
  uid: string;
  legislature: string;
  titreDossier: { titreChemin: string | null };
  actesLegislatifs?: { acteLegislatif: ActeLegislatif | ActeLegislatif[] } | null;
}

// --- Helpers ---

function flattenActes(obj: { acteLegislatif: ActeLegislatif | ActeLegislatif[] } | null | undefined): ActeLegislatif[] {
  if (!obj) return [];
  const raw = obj.acteLegislatif;
  const items: ActeLegislatif[] = Array.isArray(raw) ? raw : [raw];
  return items.flatMap((a) => [a, ...flattenActes(a.actesLegislatifs)]);
}

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDateFr(isoDate: string): string {
  const d = new Date(isoDate);
  return `${DAYS_FR[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatStatus(libelle: string): string {
  const l = libelle.toLowerCase().trim();
  if (l.startsWith('adopt') || l.startsWith('considérée comme définitive')) return 'Texte adopté ✔️';
  if (l.startsWith('rejet')) return 'Texte rejeté';
  if (l.startsWith('modif')) return 'Texte modifié';
  return libelle;
}

// --- Commission name lookup ---

// AN permanent commissions (17th legislature, confirmed from assemblee-nationale.fr)
const ORGANE_NAMES: Record<string, string> = {
  PO59046: 'Commission de la défense',
  PO59047: 'Commission des affaires étrangères',
  PO59048: 'Commission des finances',
  PO59051: 'Commission des lois',
  PO419604: 'Commission des affaires culturelles',
  PO419610: 'Commission des affaires économiques',
  PO419865: 'Commission du développement durable',
  PO420120: 'Commission des affaires sociales',
  // Senate permanent commissions (17th legislature)
  PO211490: 'Commission des affaires étrangères (Sénat)',
  PO211491: 'Commission des affaires étrangères (Sénat)',
  PO211493: 'Commission des affaires sociales (Sénat)',
  PO211494: 'Commission des finances (Sénat)',
  PO211495: 'Commission des lois (Sénat)',
  PO516753: 'Commission des affaires économiques (Sénat)',
  PO516754: 'Commission du développement durable (Sénat)',
};

// --- Step extraction ---

const READING_CODES = new Set(['AN1', 'SN1', 'AN2', 'SN2', 'ANNLEC', 'SNNLEC', 'ANLDEF']);
const TERMINAL_CODES = new Set(['CMP', 'CC', 'PROM']);

const CODE_TO_NAME: Record<string, string> = {
  AN1: "Première lecture à l'Assemblée nationale",
  SN1: 'Première lecture au Sénat',
  AN2: "Deuxième lecture à l'Assemblée nationale",
  SN2: 'Deuxième lecture au Sénat',
  ANNLEC: "Nouvelle lecture à l'Assemblée nationale",
  SNNLEC: 'Nouvelle lecture au Sénat',
  ANLDEF: "Lecture définitive à l'Assemblée nationale",
  CMP: 'Commission Mixte Paritaire',
  CC: 'Conseil constitutionnel',
  PROM: 'Promulgation de la loi',
};

const DEPOT_LABEL: Record<string, string> = {
  AN1: "Dépôt à l'Assemblée nationale",
  SN1: 'Dépôt au Sénat',
};

interface Step {
  name: string;
  date: string;
  status: string;
}

function extractSteps(dp: DossierParlementaire): Step[] | null {
  if (!dp.actesLegislatifs) return null;

  const raw = dp.actesLegislatifs.acteLegislatif;
  const topActes: ActeLegislatif[] = Array.isArray(raw) ? raw : [raw];

  const steps: Step[] = [];
  let depositAdded = false;

  for (const acte of topActes) {
    const code = acte.codeActe;

    if (READING_CODES.has(code)) {
      const subActes = flattenActes(acte.actesLegislatifs);

      const depot = subActes.find((a) => a.codeActe === `${code}-DEPOT`);
      const depotDate = depot?.dateActe?.substring(0, 10) ?? null;
      if (!depotDate) continue;

      // Add "Dépôt" step once, for the first reading
      if (!depositAdded && DEPOT_LABEL[code]) {
        steps.push({ name: DEPOT_LABEL[code], date: formatDateFr(depotDate), status: '' });
        depositAdded = true;
      }

      // Add "Renvoi en commission" step if present
      const saisie = subActes.find((a) => a.codeActe === `${code}-COM-FOND-SAISIE`);
      if (saisie?.dateActe) {
        const commissionName = ORGANE_NAMES[saisie.organeRef ?? ''] ?? 'En commission';
        steps.push({ name: 'Renvoi en commission', date: formatDateFr(saisie.dateActe.substring(0, 10)), status: commissionName });
      }

      // Only add the reading step if plenary debates have actually started
      const hasDebates = subActes.some((a) => a.codeActe.startsWith(`${code}-DEBATS`));
      if (!hasDebates) continue;

      const name = CODE_TO_NAME[code];
      if (!name) continue;

      const dec = subActes.find((a) => a.codeActe === `${code}-DEBATS-DEC`);
      const status = dec?.statutConclusion?.libelle ? formatStatus(dec.statutConclusion.libelle) : '';

      steps.push({ name, date: formatDateFr(depotDate), status });
    } else if (TERMINAL_CODES.has(code)) {
      const name = CODE_TO_NAME[code];
      if (!name) continue;

      const subActes = flattenActes(acte.actesLegislatifs);
      const firstDated = subActes.find((a) => a.dateActe);
      if (!firstDated?.dateActe) continue;

      const date = firstDated.dateActe.substring(0, 10);

      // Use the specific top-level decision node for each terminal code
      // (not a deep find, which may hit sub-chamber votes before the main decision)
      const decCode = code === 'CMP' ? 'CMP-DEC' : code === 'CC' ? 'CC-CONCLUSION' : null;
      const dec = decCode ? subActes.find((a) => a.codeActe === decCode) : null;
      const status = dec?.statutConclusion?.libelle ? formatStatus(dec.statutConclusion.libelle) : '';

      steps.push({ name, date: formatDateFr(date), status });
    }
  }

  return steps.length > 0 ? steps : null;
}

// --- Frontmatter update ---

function toTomlArray(values: string[]): string {
  return '[' + values.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',') + ']';
}

function updateFrontmatter(content: string, steps: Step[]): string {
  const replaceLine = (field: string, values: string[]) => {
    const line = `${field} = ${toTomlArray(values)}`;
    const pattern = new RegExp(`^${field} = \\[.*?\\]$`, 'm');
    if (pattern.test(content)) {
      return content.replace(pattern, line);
    }
    // Field absent: insert before closing +++
    return content.replace(/(\n\+\+\+)/, `\n${line}$1`);
  };

  content = replaceLine('stepsName', steps.map((s) => s.name));
  content = replaceLine('stepsDate', steps.map((s) => s.date));
  content = replaceLine('stepsStatus', steps.map((s) => s.status));
  return content;
}

// --- Main ---

const tmpDir = mkdtempSync(join(tmpdir(), 'dossiers-'));
let updatedCount = 0;
let skippedCount = 0;

try {
  console.log('Extracting ZIP...');
  execSync(`unzip -q -o "${zipPath}" "json/dossierParlementaire/*.json" -d "${tmpDir}"`);

  const dpDir = join(tmpDir, 'json/dossierParlementaire');

  // Index all dossiers by titreChemin and uid (all legislatures — cross-legislature dossiers
  // keep their original uid from an older legislature but contain L17 étapes)
  console.log('Building dossier index...');
  const cheminMap = new Map<string, DossierParlementaire>();
  const uidMap = new Map<string, DossierParlementaire>();
  for (const fname of readdirSync(dpDir)) {
    const data = JSON.parse(readFileSync(join(dpDir, fname), 'utf-8')) as { dossierParlementaire: DossierParlementaire };
    const dp = data.dossierParlementaire;
    const chemin = dp.titreDossier?.titreChemin;
    if (chemin) cheminMap.set(chemin, dp);
    uidMap.set(dp.uid, dp);
  }
  console.log(`Indexed ${cheminMap.size} dossiers by chemin, ${uidMap.size} by uid`);

  // Process markdown posts
  const posts = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
  console.log(`Processing ${posts.length} posts...`);

  for (const fname of posts) {
    const filePath = join(postsDir, fname);
    const content = readFileSync(filePath, 'utf-8');

    const linkMatch = content.match(/^link = "(.+?)"$/m);
    if (!linkMatch) {
      skippedCount++;
      continue;
    }

    const slug = linkMatch[1].split('/').at(-1)!;
    const dp = cheminMap.get(slug) ?? uidMap.get(slug);
    if (!dp) {
      skippedCount++;
      continue;
    }

    const steps = extractSteps(dp);
    if (!steps) {
      skippedCount++;
      continue;
    }

    const updated = updateFrontmatter(content, steps);
    if (updated !== content) {
      writeFileSync(filePath, updated, 'utf-8');
      updatedCount++;
    }
  }

  console.log(`\nDone. Updated: ${updatedCount}, skipped (no match or no steps): ${skippedCount}`);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
