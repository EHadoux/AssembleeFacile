import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { normalizeForLookup } from '$lib/utils/normalize';

export { normalizeForLookup };

export interface Depute {
	id: string;
	nom: string;
	prenom: string;
	groupe: string;
	groupeAbrev: string;
	photo: string;
}

const CSV_PATH = join(process.cwd(), 'assets/deputes-active.csv');

let _cache: Depute[] | null = null;

export function getAllDeputes(): Depute[] {
	if (_cache) return _cache;
	const raw = readFileSync(CSV_PATH, 'utf-8');
	const rows: string[][] = parse(raw, { columns: false, skip_empty_lines: true, from_line: 2 });
	_cache = rows.map((cols) => {
		const id = cols[0] ?? '';
		return {
			id,
			nom: cols[3] ?? '',
			prenom: cols[4] ?? '',
			groupe: cols[8] ?? '',
			groupeAbrev: cols[9] ?? '',
			photo: id.replace('PA', '') + '.jpg'
		};
	});
	return _cache;
}


export function findDeputeByName(fullName: string): Depute | null {
	const deputes = getAllDeputes();
	const normTarget = normalizeForLookup(fullName);

	// Try "Prénom Nom" and "M./Mme Prénom Nom" patterns
	for (const dep of deputes) {
		const fullA = normalizeForLookup(`${dep.prenom} ${dep.nom}`);
		const fullB = normalizeForLookup(`${dep.nom} ${dep.prenom}`);
		if (normTarget === fullA || normTarget === fullB) return dep;
	}

	// Looser match: target contains both nom and prenom
	for (const dep of deputes) {
		const normNom = normalizeForLookup(dep.nom);
		const normPrenom = normalizeForLookup(dep.prenom);
		if (normTarget.includes(normNom) && normTarget.includes(normPrenom)) return dep;
	}

	// Match by nom only (last resort) — require nom to be the last word of the target
	// to avoid matching e.g. "Gérard Larcher" to dep whose surname is "Gérard"
	const lastWord = normTarget.split(' ').at(-1) ?? '';
	for (const dep of deputes) {
		const normNom = normalizeForLookup(dep.nom);
		if (normNom && normNom === lastWord) return dep;
	}

	return null;
}
