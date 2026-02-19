import { readFileSync } from 'fs';
import { join } from 'path';

export interface Depute {
	id: string;
	nom: string;
	prenom: string;
	groupe: string;
	groupeAbrev: string;
	photo: string;
}

// process.cwd() = app/ directory (where vite build runs)
const CSV_PATH = join(process.cwd(), '../assets/deputes-active.csv');

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
	_cache = rows.slice(1).map((cols) => ({
		id: cols[0] ?? '',
		nom: cols[3] ?? '',
		prenom: cols[4] ?? '',
		groupe: cols[8] ?? '',
		groupeAbrev: cols[9] ?? '',
		photo: cols[27] ?? ''
	}));
	return _cache;
}

export function normalizeForLookup(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
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

	// Match by nom only (last resort)
	for (const dep of deputes) {
		const normNom = normalizeForLookup(dep.nom);
		if (normNom && normTarget.includes(normNom)) return dep;
	}

	return null;
}
