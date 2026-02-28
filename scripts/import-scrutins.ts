import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { db } from './_db.ts';

const [dossiersZip, scrutinsZip] = process.argv.slice(2);
if (!dossiersZip || !scrutinsZip || !existsSync(dossiersZip) || !existsSync(scrutinsZip)) {
  console.error('Usage: tsx scripts/import-scrutins.ts <Dossiers_Legislatifs.json.zip> <Scrutins.json.zip>');
  process.exit(1);
}

// --- Types ---

interface ActeLegislatif {
  voteRefs?: { voteRef: string | string[] } | null;
  actesLegislatifs?: { acteLegislatif: ActeLegislatif | ActeLegislatif[] } | null;
}

interface DossierParlementaire {
  uid: string;
  actesLegislatifs?: { acteLegislatif: ActeLegislatif | ActeLegislatif[] } | null;
}

function flattenActes(obj: { acteLegislatif: ActeLegislatif | ActeLegislatif[] } | null | undefined): ActeLegislatif[] {
  if (!obj) return [];
  const raw = obj.acteLegislatif;
  const items: ActeLegislatif[] = Array.isArray(raw) ? raw : [raw];
  return items.flatMap((a) => [a, ...flattenActes(a.actesLegislatifs)]);
}

function extractVoteRefs(dp: DossierParlementaire): string[] {
  const actes = flattenActes(dp.actesLegislatifs);
  const refs: string[] = [];
  for (const acte of actes) {
    if (acte.voteRefs) {
      for (const ref of toArray(acte.voteRefs.voteRef)) {
        refs.push(ref);
      }
    }
  }
  return refs;
}

interface ScrutinJson {
  scrutin: {
    uid: string;
    numero: string;
    dateScrutin: string;
    typeVote: { codeTypeVote: string };
    sort: { code: string };
    titre: string;
    syntheseVote: {
      nombreVotants: string;
      suffragesExprimes: string;
      decompte: {
        pour: string;
        contre: string;
        abstentions: string;
        nonVotants: string;
      };
    };
    ventilationVotes: {
      organe: {
        groupes: {
          groupe: GroupeVote | GroupeVote[];
        };
      };
    };
  };
}

interface GroupeVote {
  organeRef: string;
  vote: {
    positionMajoritaire: string;
    decompteVoix: {
      pour: string;
      contre: string;
      abstentions: string;
      nonVotants: string;
    };
    decompteNominatif: {
      pours: { votant: Votant | Votant[] } | null;
      contres: { votant: Votant | Votant[] } | null;
      abstentions: { votant: Votant | Votant[] } | null;
      nonVotants: { votant: Votant | Votant[] } | null;
    };
  };
}

interface Votant {
  acteurRef: string;
  parDelegation: string;
}

// --- Helpers ---

function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function isFinalVote(titre: string): boolean {
  const t = titre.toLowerCase();
  return (
    t.startsWith("l'ensemble de la proposition de loi") ||
    t.startsWith("l'ensemble du projet de loi") ||
    t.startsWith("l'ensemble de la proposition de résolution") ||
    t.startsWith("l'ensemble de la proposition de loi organique") ||
    t.startsWith("l'ensemble du projet de loi organique") ||
    t.startsWith('l\'ensemble de la proposition de loi constitutionnelle')
  );
}

// --- Load group organe_ref → abrev mapping from DB ---
// We build this by looking at depute votes: acteurRef (PA{id}) → depute id → groupe_abrev.
// This lets us resolve organe refs without a hardcoded map.
// For refs that remain unresolved we store the raw organe_ref as fallback.

const deputeGroupeMap = new Map<string, string>(); // acteurRef → groupe_abrev
{
  const rows = db.prepare(`
    SELECT 'PA' || REPLACE(id, 'PA', '') AS acteur_ref, groupe_abrev
    FROM deputes
    WHERE groupe_abrev IS NOT NULL
  `).all() as { acteur_ref: string; groupe_abrev: string }[];
  for (const { acteur_ref, groupe_abrev } of rows) {
    deputeGroupeMap.set(acteur_ref, groupe_abrev);
  }
}

// organeRef → groupe_abrev, resolved lazily per scrutin via decompteNominatif
function resolveGroupeAbrev(organeRef: string, groupeVote: GroupeVote): string {
  // Try to find any depute who voted in this group
  for (const bucket of [
    groupeVote.vote.decompteNominatif.pours,
    groupeVote.vote.decompteNominatif.contres,
    groupeVote.vote.decompteNominatif.abstentions,
    groupeVote.vote.decompteNominatif.nonVotants,
  ]) {
    for (const v of toArray(bucket?.votant)) {
      const abrev = deputeGroupeMap.get(v.acteurRef);
      if (abrev) return abrev;
    }
  }
  // Fallback: return the raw organeRef (will not match a colour but data is preserved)
  return organeRef;
}

// --- Load existing articles with dossier_ref ---

const articles = db.prepare(`
  SELECT slug, dossier_ref FROM articles WHERE dossier_ref IS NOT NULL
`).all() as { slug: string; dossier_ref: string }[];
const dossierToSlug = new Map<string, string>(articles.map(({ slug, dossier_ref }) => [dossier_ref, slug]));
console.log(`Found ${dossierToSlug.size} articles with dossier_ref`);

// --- Prepared statements ---

const insertScrutin = db.prepare(`
  INSERT OR IGNORE INTO scrutins
    (uid, numero, date_scrutin, type_vote, titre, sort, pour, contre, abstentions, non_votants, votants, suffrages_exprimes, article_slug)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertGroupe = db.prepare(`
  INSERT OR REPLACE INTO scrutin_votes_groupes
    (scrutin_uid, groupe_abrev, position_majoritaire, pour, contre, abstentions, non_votants)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertDepute = db.prepare(`
  INSERT OR REPLACE INTO scrutin_votes_deputes
    (scrutin_uid, acteur_ref, position, par_delegation)
  VALUES (?, ?, ?, ?)
`);

// --- Main ---

let tmpDirDossiers = '';
let tmpDirScrutins = '';
let importedScrutins = 0;
let skippedScrutins = 0;
let unresolvedGroupes = new Set<string>();

try {
  console.log('Extracting Dossiers ZIP...');
  tmpDirDossiers = mkdtempSync(join(tmpdir(), 'dossiers-scrutins-'));
  execSync(`unzip -q -o "${dossiersZip}" "json/dossierParlementaire/*.json" -d "${tmpDirDossiers}"`);

  // Build dossierUid → voteRefs[] by flattening the actesLegislatifs tree
  console.log('Building dossier → voteRefs index...');
  const dossierVoteRefs = new Map<string, string[]>(); // dossierUid → [scrutinUid, ...]
  const dpDir = join(tmpDirDossiers, 'json/dossierParlementaire');
  for (const fname of readdirSync(dpDir)) {
    const raw = JSON.parse(readFileSync(join(dpDir, fname), 'utf-8')) as { dossierParlementaire: DossierParlementaire };
    const dp = raw.dossierParlementaire;
    const refs = extractVoteRefs(dp);
    if (refs.length) dossierVoteRefs.set(dp.uid, refs);
  }
  console.log(`Dossiers with voteRefs: ${dossierVoteRefs.size}`);

  // Build scrutinUid → scrutin JSON (only final votes for articles we track)
  console.log('Extracting Scrutins ZIP...');
  tmpDirScrutins = mkdtempSync(join(tmpdir(), 'scrutins-'));
  execSync(`unzip -q -o "${scrutinsZip}" "*.json" -d "${tmpDirScrutins}"`);

  console.log('Indexing scrutin files...');
  const scrutinMap = new Map<string, ScrutinJson['scrutin']>();

  function walkDir(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.json')) {
        try {
          const raw = JSON.parse(readFileSync(fullPath, 'utf-8')) as ScrutinJson;
          const s = raw.scrutin;
          if (s?.uid && s.titre && isFinalVote(s.titre)) {
            scrutinMap.set(s.uid, s);
          }
        } catch { /* skip malformed files */ }
      }
    }
  }
  walkDir(tmpDirScrutins);
  console.log(`Final-vote scrutins indexed: ${scrutinMap.size}`);

  function importScrutin(scrutin: ScrutinJson['scrutin'], articleSlug: string) {
    const d = scrutin.syntheseVote.decompte;
    insertScrutin.run(
      scrutin.uid,
      parseInt(scrutin.numero),
      scrutin.dateScrutin,
      scrutin.typeVote.codeTypeVote,
      scrutin.titre,
      scrutin.sort.code,
      parseInt(d.pour),
      parseInt(d.contre),
      parseInt(d.abstentions),
      parseInt(d.nonVotants),
      parseInt(scrutin.syntheseVote.nombreVotants),
      parseInt(scrutin.syntheseVote.suffragesExprimes),
      articleSlug,
    );

    const groupes = toArray(scrutin.ventilationVotes.organe.groupes.groupe);
    for (const g of groupes) {
      const abrev = resolveGroupeAbrev(g.organeRef, g);
      if (abrev === g.organeRef) unresolvedGroupes.add(g.organeRef);
      const v = g.vote.decompteVoix;
      insertGroupe.run(
        scrutin.uid,
        abrev,
        g.vote.positionMajoritaire,
        parseInt(v.pour),
        parseInt(v.contre),
        parseInt(v.abstentions),
        parseInt(v.nonVotants),
      );

      // Import individual député votes
      const nominatif = g.vote.decompteNominatif;
      for (const votant of toArray(nominatif.pours?.votant)) {
        insertDepute.run(scrutin.uid, votant.acteurRef, 'pour', votant.parDelegation === 'true' ? 1 : 0);
      }
      for (const votant of toArray(nominatif.contres?.votant)) {
        insertDepute.run(scrutin.uid, votant.acteurRef, 'contre', votant.parDelegation === 'true' ? 1 : 0);
      }
      for (const votant of toArray(nominatif.abstentions?.votant)) {
        insertDepute.run(scrutin.uid, votant.acteurRef, 'abstention', votant.parDelegation === 'true' ? 1 : 0);
      }
      for (const votant of toArray(nominatif.nonVotants?.votant)) {
        insertDepute.run(scrutin.uid, votant.acteurRef, 'nonVotant', votant.parDelegation === 'true' ? 1 : 0);
      }
    }
  }

  // For each article, find and import its scrutins
  console.log('Importing scrutins...');
  db.exec('BEGIN');
  try {
    for (const [dossierUid, voteRefs] of dossierVoteRefs) {
      const articleSlug = dossierToSlug.get(dossierUid);
      if (!articleSlug) continue;

      for (const ref of voteRefs) {
        const scrutin = scrutinMap.get(ref);
        if (!scrutin) {
          skippedScrutins++;
          continue;
        }
        importScrutin(scrutin, articleSlug);
        importedScrutins++;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  console.log(`\nDone.`);
  console.log(`  Imported: ${importedScrutins} scrutins`);
  console.log(`  Skipped (not a final vote or not in index): ${skippedScrutins}`);
  if (unresolvedGroupes.size > 0) {
    console.warn(`  Unresolved group organeRefs (stored as-is): ${[...unresolvedGroupes].join(', ')}`);
  }
} finally {
  if (tmpDirDossiers) rmSync(tmpDirDossiers, { recursive: true, force: true });
  if (tmpDirScrutins) rmSync(tmpDirScrutins, { recursive: true, force: true });
}
