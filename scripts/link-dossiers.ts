import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { db } from './_db.ts';

const zipPath = process.argv[2];
if (!zipPath || !existsSync(zipPath)) {
  console.error('Usage: tsx scripts/link-dossiers.ts <path-to-Dossiers_Legislatifs.json.zip>');
  process.exit(1);
}

interface DossierParlementaire {
  uid: string;
  titreDossier: { titreChemin: string | null };
}

const tmpDir = mkdtempSync(join(tmpdir(), 'dossiers-link-'));
let updatedCount = 0;

try {
  console.log('Extracting ZIP...');
  execSync(`unzip -q -o "${zipPath}" "json/dossierParlementaire/*.json" -d "${tmpDir}"`);

  const dpDir = join(tmpDir, 'json/dossierParlementaire');

  console.log('Building dossier index...');
  const cheminMap = new Map<string, string>();
  const uidMap = new Map<string, string>();
  for (const fname of readdirSync(dpDir)) {
    const data = JSON.parse(readFileSync(join(dpDir, fname), 'utf-8')) as { dossierParlementaire: DossierParlementaire };
    const dp = data.dossierParlementaire;
    const chemin = dp.titreDossier?.titreChemin;
    if (chemin) cheminMap.set(chemin, dp.uid);
    uidMap.set(dp.uid, dp.uid);
  }
  console.log(`Indexed ${cheminMap.size} dossiers by chemin, ${uidMap.size} by uid`);

  const articles = db.prepare('SELECT slug, lien FROM articles WHERE dossier_ref IS NULL').all() as { slug: string; lien: string | null }[];
  console.log(`Processing ${articles.length} articles without dossier_ref...`);

  const update = db.prepare('UPDATE articles SET dossier_ref = ? WHERE slug = ?');

  for (const { slug, lien } of articles) {
    if (!lien) continue;
    const anSlug = lien.split('/').at(-1);
    if (!anSlug) continue;
    const uid = cheminMap.get(anSlug) ?? uidMap.get(anSlug);
    if (!uid) continue;
    update.run(uid, slug);
    updatedCount++;
  }

  console.log(`\nDone. Updated: ${updatedCount}`);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
