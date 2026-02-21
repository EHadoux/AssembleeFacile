import { readFileSync } from 'fs';
import { join } from 'path';
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

function parseCSV(raw: string): string[][] {
	const lines = raw.trim().split('\n');
	return lines.map((line) => {
		const fields: string[] = [];
		let inQuote = false;
		let current = '';
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				inQuote = !inQuote;
			} else if (ch === ',' && !inQuote) {
				fields.push(current);
				current = '';
			} else {
				current += ch;
			}
		}
		fields.push(current);
		return fields;
	});
}

let _cache: Depute[] | null = null;

export function getAllDeputes(): Depute[] {
	if (_cache) return _cache;
	const raw = readFileSync(CSV_PATH, 'utf-8');
	const rows = parseCSV(raw);
	// Skip header row
	_cache = rows.slice(1).map((cols) => {
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
