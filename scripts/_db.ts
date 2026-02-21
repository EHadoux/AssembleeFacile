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
