import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

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
	count: number;
	groupeAbrev: string | null;
	couleur: string | null;
	photo: string | null;
}

export function getTopContributors(limit: number): TopContributor[] {
	const stmt = db.prepare(`
		SELECT
			d.prenom || ' ' || d.nom AS name,
			d.groupe_abrev AS groupeAbrev,
			g.couleur,
			d.photo,
			COUNT(DISTINCT aa.article_slug) AS count
		FROM article_auteurs aa
		JOIN deputes d ON aa.depute_id = d.id
		LEFT JOIN groupes g ON d.groupe_abrev = g.abrev
		GROUP BY d.id
		ORDER BY count DESC
		LIMIT ?
	`);
	return stmt.all(limit) as unknown as TopContributor[];
}

export function getPropositionsByGroupe(): GroupeStat[] {
	const stmt = db.prepare(`
		SELECT g.abrev, g.nom, g.couleur, COUNT(DISTINCT aa.article_slug) AS count
		FROM article_auteurs aa
		JOIN deputes d ON aa.depute_id = d.id
		JOIN groupes g ON d.groupe_abrev = g.abrev
		WHERE d.groupe_abrev IS NOT NULL
		GROUP BY g.abrev
		ORDER BY count DESC
	`);
	return stmt.all() as unknown as GroupeStat[];
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

function getAllDeputesFromDb(): DeputeDetail[] {
	if (_deputesCache) return _deputesCache;
	const stmt = db.prepare(`
		SELECT id, nom, prenom, groupe_abrev, photo, profession,
		       departement_nom, departement_code, circo, mail, twitter, facebook,
		       website, nombre_mandats, score_participation, score_participation_specialite,
		       score_loyaute, score_majorite, date_prise_fonction
		FROM deputes
	`);
	_deputesCache = stmt.all() as unknown as DeputeDetail[];
	return _deputesCache;
}

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
		if (normNom && normPrenom && normTarget.includes(normNom) && normTarget.includes(normPrenom))
			return dep;
	}

	for (const dep of deputes) {
		const normNom = normalizeStr(dep.nom);
		if (normNom && normTarget.includes(normNom)) return dep;
	}

	return null;
}

export function getTopCosignataires(deputeId: string, limit: number): Cosignataire[] {
	const stmt = db.prepare(`
		SELECT
			d2.prenom || ' ' || d2.nom AS name,
			d2.groupe_abrev AS groupeAbrev,
			g.couleur,
			d2.photo,
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
