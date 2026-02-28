CREATE TABLE IF NOT EXISTS scrutins (
    uid                TEXT PRIMARY KEY,
    numero             INTEGER,
    date_scrutin       TEXT,
    type_vote          TEXT,
    titre              TEXT,
    sort               TEXT,
    pour               INTEGER,
    contre             INTEGER,
    abstentions        INTEGER,
    non_votants        INTEGER,
    votants            INTEGER,
    suffrages_exprimes INTEGER,
    article_slug       TEXT,
    FOREIGN KEY (article_slug) REFERENCES articles(slug)
);

CREATE INDEX IF NOT EXISTS idx_scrutins_article ON scrutins(article_slug);

CREATE TABLE IF NOT EXISTS scrutin_votes_groupes (
    scrutin_uid          TEXT NOT NULL,
    groupe_abrev         TEXT NOT NULL,
    position_majoritaire TEXT,
    pour                 INTEGER,
    contre               INTEGER,
    abstentions          INTEGER,
    non_votants          INTEGER,
    PRIMARY KEY (scrutin_uid, groupe_abrev)
);

CREATE TABLE IF NOT EXISTS scrutin_votes_deputes (
    scrutin_uid    TEXT NOT NULL,
    acteur_ref     TEXT NOT NULL,
    position       TEXT NOT NULL,
    par_delegation INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (scrutin_uid, acteur_ref)
);

CREATE INDEX IF NOT EXISTS idx_svd_acteur ON scrutin_votes_deputes(acteur_ref);
