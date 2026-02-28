ALTER TABLE articles ADD COLUMN dossier_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_articles_dossier_ref ON articles(dossier_ref);
