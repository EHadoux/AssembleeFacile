import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('.', import.meta.url));
const dbPath = join(dir, '../db/assemblee.db');
const migrationPath = join(dir, '../db/001_init.sql');

export const db = new DatabaseSync(dbPath);

const migration = readFileSync(migrationPath, 'utf-8');
db.exec(migration);

try {
  const migration2 = readFileSync(join(dir, '../db/002_add_authors_from_an.sql'), 'utf-8');
  db.exec(migration2);
} catch { /* columns already exist */ }

try {
  const migration3 = readFileSync(join(dir, '../db/003_add_dossier_ref.sql'), 'utf-8');
  db.exec(migration3);
} catch { /* columns already exist */ }

try {
  const migration4 = readFileSync(join(dir, '../db/004_add_scrutins.sql'), 'utf-8');
  db.exec(migration4);
} catch { /* tables already exist */ }
