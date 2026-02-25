import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = join(process.cwd(), 'db/assemblee.db');
const db = new DatabaseSync(dbPath);

export interface GroupeStat {
  abrev: string;
  nom: string;
  couleur: string;
  count: number;
}

export interface TopContributor {
  name: string;
  count_auteur: number;
  count_cosig: number;
  groupeAbrev: string | null;
  couleur: string | null;
  photo: string | null;
}

/** Classement des députés par nombre de propositions déposées en tant qu'auteur principal.
 *  Utilisé : `routes/+page.server.ts` (bloc d'accueil "top contributeurs"). */
export function getTopContributors(limit: number): TopContributor[] {
  const stmt = db.prepare(`
		SELECT
			d.prenom || ' ' || d.nom AS name,
			d.groupe_abrev AS groupeAbrev,
			g.couleur,
			REPLACE(d.id, 'PA', '') || '.jpg' AS photo,
			COUNT(DISTINCT CASE WHEN aa.role = 'auteur' OR (aa.role IS NULL AND aa.ordre = 0)
				THEN aa.article_slug END) AS count_auteur,
			COUNT(DISTINCT CASE WHEN aa.role = 'cosignataire'
				THEN aa.article_slug END) AS count_cosig
		FROM deputes d
		JOIN groupes g ON g.abrev = d.groupe_abrev
		LEFT JOIN article_auteurs aa ON aa.depute_id = d.id
		GROUP BY d.id
		HAVING count_auteur > 0
		ORDER BY count_auteur DESC, count_cosig DESC
		LIMIT ?
	`);
  return stmt.all(limit) as unknown as TopContributor[];
}

/** Nombre de propositions par groupe politique (auteurs principaux uniquement).
 *  Utilisé : `routes/+page.server.ts` (statistiques d'accueil par groupe). */
export function getPropositionsByGroupe(): GroupeStat[] {
  const stmt = db.prepare(`
		SELECT g.abrev, g.nom, g.couleur, COUNT(DISTINCT aa.article_slug) AS count
		FROM groupes g
		JOIN deputes d ON d.groupe_abrev = g.abrev
		JOIN article_auteurs aa ON aa.depute_id = d.id
		WHERE aa.role = 'auteur' OR (aa.role IS NULL AND aa.ordre = 0)
		GROUP BY g.abrev
		ORDER BY count DESC
	`);
  return stmt.all() as unknown as GroupeStat[];
}

export interface AuthorCounts {
  count_auteur: number;
  count_cosig: number;
}

/** Compte les propositions d'un député donné (auteur principal + cosignataire).
 *  Utilisé : `routes/auteurs/[slug]/+page.server.ts` et `routes/auteurs/+page.server.ts`. */
export function getAuthorCounts(deputeId: string): AuthorCounts {
  const stmt = db.prepare(`
		SELECT
			COUNT(DISTINCT CASE WHEN role = 'auteur' OR (role IS NULL AND ordre = 0)
				THEN article_slug END) AS count_auteur,
			COUNT(DISTINCT CASE WHEN role = 'cosignataire'
				THEN article_slug END) AS count_cosig
		FROM article_auteurs
		WHERE depute_id = ?
	`);
  return stmt.get(deputeId) as unknown as AuthorCounts;
}

export interface DeputeDetail {
  id: string;
  nom: string;
  prenom: string;
  groupe_abrev: string | null;
  photo: string | null;
  profession: string | null;
  departement_nom: string | null;
  departement_code: string | null;
  circo: number | null;
  mail: string | null;
  twitter: string | null;
  facebook: string | null;
  website: string | null;
  nombre_mandats: number | null;
  score_participation: number | null;
  score_participation_specialite: number | null;
  score_loyaute: number | null;
  score_majorite: number | null;
  date_prise_fonction: string | null;
}

export interface Cosignataire {
  name: string;
  groupeAbrev: string | null;
  couleur: string | null;
  photo: string | null;
  count: number;
}

/** Normalisation interne : minuscules, sans accents, sans ponctuation, espaces condensés.
 *  Utilisée uniquement dans ce fichier pour les comparaisons de noms. */
function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let _deputesCache: DeputeDetail[] | null = null;

/** Charge tous les députés depuis la DB avec mise en cache en mémoire (singleton de module).
 *  Utilisée en interne par `findDeputeByNameInDb`. */
function getAllDeputesFromDb(): DeputeDetail[] {
  if (_deputesCache) return _deputesCache;
  const stmt = db.prepare(`
		SELECT id, nom, prenom, groupe_abrev, REPLACE(id, 'PA', '') || '.jpg' AS photo, profession,
		       departement_nom, departement_code, circo, mail, twitter, facebook,
		       website, nombre_mandats, score_participation, score_participation_specialite,
		       score_loyaute, score_majorite, date_prise_fonction
		FROM deputes
	`);
  _deputesCache = stmt.all() as unknown as DeputeDetail[];
  return _deputesCache;
}

/** Recherche floue d'un député par son nom complet (trois passes : nom+prénom exact →
 *  inclusion des deux → nom seul). Couvre les variations issues du LLM dans les frontmatters.
 *  Utilisée : `routes/auteurs/[slug]/+page.server.ts`. */
export function findDeputeByNameInDb(fullName: string): DeputeDetail | null {
  const deputes = getAllDeputesFromDb();
  const normTarget = normalizeStr(fullName);

  for (const dep of deputes) {
    const fullA = normalizeStr(`${dep.prenom} ${dep.nom}`);
    const fullB = normalizeStr(`${dep.nom} ${dep.prenom}`);
    if (normTarget === fullA || normTarget === fullB) return dep;
  }

  for (const dep of deputes) {
    const normNom = normalizeStr(dep.nom);
    const normPrenom = normalizeStr(dep.prenom);
    if (normNom && normPrenom && normTarget.includes(normNom) && normTarget.includes(normPrenom)) return dep;
  }

  for (const dep of deputes) {
    const normNom = normalizeStr(dep.nom);
    if (normNom && (normTarget === normNom || normTarget.endsWith(' ' + normNom))) return dep;
  }

  return null;
}

export interface MostCosigned {
  slug: string;
  titre_court: string;
  nb_cosignataires: number;
}

/** Nombre total de députés actifs (retire = 0).
 *  Utilisé : `routes/+page.server.ts` (statistique d'accueil). */
export function getDeputeCount(): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM deputes WHERE retire = 0').get() as { c: number };
  return row.c;
}

/** Propositions avec le plus grand nombre de signataires (toutes signatures confondues).
 *  Utilisé : `routes/+page.server.ts` (bloc d'accueil "les plus cosignées"). */
export function getMostCosigned(limit: number): MostCosigned[] {
  const stmt = db.prepare(`
		SELECT
			a.slug,
			a.titre_court,
			COUNT(aa.depute_id) AS nb_cosignataires
		FROM articles a
		JOIN article_auteurs aa ON a.slug = aa.article_slug
		WHERE aa.depute_id IS NOT NULL
		GROUP BY a.slug
		ORDER BY nb_cosignataires DESC
		LIMIT ?
	`);
  return stmt.all(limit) as unknown as MostCosigned[];
}

export interface MostTransPartisan {
  slug: string;
  titre_court: string;
  nb_groupes: number;
  nb_cosignataires: number;
  groupes: string[];
}

/** Propositions réunissant le plus de groupes politiques différents (≥ 2).
 *  Trie par nb_groupes DESC puis nb_cosignataires DESC.
 *  Utilisé : `routes/+page.server.ts` (bloc d'accueil "les plus transpartisanes"). */
export function getMostTransPartisan(limit: number): MostTransPartisan[] {
  const stmt = db.prepare(`
		SELECT
			a.slug,
			a.titre_court,
			COUNT(DISTINCT d.groupe_abrev) AS nb_groupes,
			COUNT(aa.depute_id) AS nb_cosignataires,
			GROUP_CONCAT(DISTINCT d.groupe_abrev) AS groupes_str
		FROM articles a
		JOIN article_auteurs aa ON a.slug = aa.article_slug
		JOIN deputes d ON aa.depute_id = d.id
		WHERE d.groupe_abrev IS NOT NULL
		GROUP BY a.slug
		HAVING nb_groupes >= 2
		ORDER BY nb_groupes DESC, nb_cosignataires DESC
		LIMIT ?
	`);
  type Row = Omit<MostTransPartisan, 'groupes'> & { groupes_str: string };
  return (stmt.all(limit) as unknown as Row[]).map(r => ({
    slug: r.slug,
    titre_court: r.titre_court,
    nb_groupes: r.nb_groupes,
    nb_cosignataires: r.nb_cosignataires,
    groupes: r.groupes_str ? r.groupes_str.split(',') : []
  }));
}

export interface ArticleSignataire {
  depute_id: string;
  role: string | null;
  ordre: number;
}

/** Récupère tous les signataires (auteur + cosignataires) d'une proposition, triés par ordre.
 *  Utilisé : `routes/posts/[slug]/+page.server.ts` (sidebar de la fiche de proposition). */
export function getArticleSignataires(slug: string): ArticleSignataire[] {
  const stmt = db.prepare(`
		SELECT depute_id, role, ordre
		FROM article_auteurs
		WHERE article_slug = ?
		ORDER BY ordre ASC
	`);
  return stmt.all(slug) as unknown as ArticleSignataire[];
}

export interface ArticleRoles {
  auteursPrincipaux: string[];
  cosignataires: string[];
}

/** Construit une Map slug → { auteursPrincipaux, cosignataires } pour toutes les propositions.
 *  Chargée en une seule requête pour éviter les N+1 lors de la génération de l'index de recherche.
 *  Utilisée : `routes/search.json/+server.ts`. */
export function getAllArticleRoles(): Map<string, ArticleRoles> {
  const stmt = db.prepare(`
		SELECT article_slug, nom_brut, role, ordre
		FROM article_auteurs
		ORDER BY article_slug, ordre
	`);
  type Row = { article_slug: string; nom_brut: string; role: string | null; ordre: number };
  const rows = stmt.all() as unknown as Row[];

  const map = new Map<string, ArticleRoles>();
  for (const row of rows) {
    let entry = map.get(row.article_slug);
    if (!entry) {
      entry = { auteursPrincipaux: [], cosignataires: [] };
      map.set(row.article_slug, entry);
    }
    if (row.role === 'auteur' || (row.role === null && row.ordre === 0)) {
      entry.auteursPrincipaux.push(row.nom_brut);
    } else if (row.role === 'cosignataire') {
      entry.cosignataires.push(row.nom_brut);
    }
  }
  return map;
}

/** Députés ayant le plus souvent cosigné avec le député donné (co-occurrence sur les mêmes articles).
 *  Utilisé : `routes/auteurs/[slug]/+page.server.ts` (bloc "cosignateurs fréquents"). */
export function getTopCosignataires(deputeId: string, limit: number): Cosignataire[] {
  const stmt = db.prepare(`
		SELECT
			d2.prenom || ' ' || d2.nom AS name,
			d2.groupe_abrev AS groupeAbrev,
			g.couleur,
			REPLACE(d2.id, 'PA', '') || '.jpg' AS photo,
			COUNT(*) AS count
		FROM article_auteurs aa1
		JOIN article_auteurs aa2 ON aa1.article_slug = aa2.article_slug
			AND aa1.depute_id <> aa2.depute_id
		JOIN deputes d1 ON aa1.depute_id = d1.id
		JOIN deputes d2 ON aa2.depute_id = d2.id
		LEFT JOIN groupes g ON d2.groupe_abrev = g.abrev
		WHERE d1.id = ?
		GROUP BY d2.id
		ORDER BY count DESC
		LIMIT ?
	`);
  return stmt.all(deputeId, limit) as unknown as Cosignataire[];
}
