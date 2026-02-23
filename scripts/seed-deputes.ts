import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './_db.ts';

const dir = fileURLToPath(new URL('.', import.meta.url));
const assetsDir = join(dir, '../assets');

type DeputeRow = {
  id: string;
  legislature: string;
  civ: string;
  nom: string;
  prenom: string;
  villeNaissance: string;
  naissance: string;
  age: string;
  groupe: string;
  groupeAbrev: string;
  departementNom: string;
  departementCode: string;
  circo: string;
  datePriseFonction: string;
  job: string;
  mail: string;
  twitter: string;
  facebook: string;
  website: string;
  nombreMandats: string;
  experienceDepute: string;
  scoreParticipation: string;
  scoreParticipationSpecialite: string;
  scoreLoyaute: string;
  scoreMajorite: string;
  dateMaj: string;
};

const deputesCsv = readFileSync(join(assetsDir, 'deputes-active.csv'), 'utf-8');
const deputeRows: DeputeRow[] = parse(deputesCsv, { columns: true, skip_empty_lines: true, trim: true });

const upsertDepute = db.prepare(
  `INSERT INTO deputes (
     id, legislature, civilite, nom, prenom, groupe_abrev,
     ville_naissance, date_naissance, departement_nom, departement_code, circo,
     date_prise_fonction, profession, mail, twitter, facebook, website,
     nombre_mandats, score_participation, score_participation_specialite,
     score_loyaute, score_majorite, date_maj, retire
   ) VALUES (
     ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0
   )
   ON CONFLICT(id) DO UPDATE SET
     legislature = excluded.legislature,
     civilite = excluded.civilite,
     nom = excluded.nom,
     prenom = excluded.prenom,
     groupe_abrev = excluded.groupe_abrev,
     ville_naissance = excluded.ville_naissance,
     date_naissance = excluded.date_naissance,
     departement_nom = excluded.departement_nom,
     departement_code = excluded.departement_code,
     circo = excluded.circo,
     date_prise_fonction = excluded.date_prise_fonction,
     profession = excluded.profession,
     mail = excluded.mail,
     twitter = excluded.twitter,
     facebook = excluded.facebook,
     website = excluded.website,
     nombre_mandats = excluded.nombre_mandats,
     score_participation = excluded.score_participation,
     score_participation_specialite = excluded.score_participation_specialite,
     score_loyaute = excluded.score_loyaute,
     score_majorite = excluded.score_majorite,
     date_maj = excluded.date_maj,
     retire = 0`,
);

// Ensure every group referenced by deputies exists (e.g. "NI" not in groupes.csv)
const ensureGroupe = db.prepare(`INSERT OR IGNORE INTO groupes (abrev, nom, couleur) VALUES (?, ?, '#888888')`);
for (const row of deputeRows) {
  if (row.groupeAbrev?.trim()) ensureGroupe.run(row.groupeAbrev.trim(), row.groupe ?? row.groupeAbrev.trim());
}

const activeIds = new Set<string>();
let inserted = 0;
let updated = 0;

for (const row of deputeRows) {
  if (!row.id) continue;
  activeIds.add(row.id);

  const existing = db.prepare('SELECT id FROM deputes WHERE id = ?').get(row.id);
  upsertDepute.run(
    row.id,
    parseInt(row.legislature) || 17,
    row.civ || null,
    row.nom,
    row.prenom,
    row.groupeAbrev?.trim() || null,
    row.villeNaissance || null,
    row.naissance || null,
    row.departementNom || null,
    row.departementCode || null,
    parseInt(row.circo) || null,
    row.datePriseFonction || null,
    row.job || null,
    row.mail || null,
    row.twitter || null,
    row.facebook || null,
    row.website || null,
    parseInt(row.nombreMandats) || null,
    parseFloat(row.scoreParticipation) || null,
    parseFloat(row.scoreParticipationSpecialite) || null,
    parseFloat(row.scoreLoyaute) || null,
    parseFloat(row.scoreMajorite) || null,
    row.dateMaj || null,
  );

  if (existing) updated++;
  else inserted++;
}

// Mark deputies no longer in the CSV as retired
const markRetired = db.prepare('UPDATE deputes SET retire = 1 WHERE id = ? AND retire = 0');
const allInDb = db.prepare('SELECT id FROM deputes WHERE retire = 0').all() as { id: string }[];
let retired = 0;
for (const row of allInDb) {
  if (!activeIds.has(row.id)) {
    markRetired.run(row.id);
    retired++;
  }
}

console.log(`Députés : ${inserted} inserted, ${updated} updated, ${retired} marked as retired`);
