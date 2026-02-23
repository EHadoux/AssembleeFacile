import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { GROUPE_ORDER } from '$lib/utils/groupe-order';

export { GROUPE_ORDER };

export interface Groupe {
	nom: string;
	abrev: string;
	couleur: string;
}

const dbPath = join(process.cwd(), 'db/assemblee.db');

let _cache: Groupe[] | null = null;

export function getAllGroupes(): Groupe[] {
	if (_cache) return _cache;
	const db = new DatabaseSync(dbPath);
	const rows = db.prepare('SELECT nom, abrev, couleur FROM groupes').all() as unknown as Groupe[];
	_cache = rows;
	return _cache;
}

export function getGroupeMap(): Map<string, Groupe> {
	const map = new Map<string, Groupe>();
	for (const g of getAllGroupes()) {
		map.set(g.abrev, g);
	}
	return map;
}
