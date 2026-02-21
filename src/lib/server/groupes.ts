import { readFileSync } from 'fs';
import { join } from 'path';
import { GROUPE_ORDER } from '$lib/utils/groupe-order';

export { GROUPE_ORDER };

export interface Groupe {
	nom: string;
	abrev: string;
	couleur: string;
}

const CSV_PATH = join(process.cwd(), 'assets/groupes.csv');


let _cache: Groupe[] | null = null;

export function getAllGroupes(): Groupe[] {
	if (_cache) return _cache;
	const raw = readFileSync(CSV_PATH, 'utf-8');
	const lines = raw.trim().split('\n').slice(1);
	_cache = lines.map((line) => {
		const [nom, abrev, couleur] = line.split(',');
		return { nom: nom ?? '', abrev: abrev ?? '', couleur: couleur?.trim() ?? '#888' };
	});
	return _cache;
}

export function getGroupeMap(): Map<string, Groupe> {
	const map = new Map<string, Groupe>();
	for (const g of getAllGroupes()) {
		map.set(g.abrev, g);
	}
	return map;
}
