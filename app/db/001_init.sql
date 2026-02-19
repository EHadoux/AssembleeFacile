PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS groupes (
    abrev TEXT PRIMARY KEY,
    nom   TEXT NOT NULL,
    couleur TEXT NOT NULL DEFAULT '#666666'
);

CREATE TABLE IF NOT EXISTS deputes (
    id                            TEXT PRIMARY KEY,
    legislature                   INTEGER NOT NULL,
    civilite                      TEXT,
    nom                           TEXT NOT NULL,
    prenom                        TEXT NOT NULL,
    groupe_abrev                  TEXT,
    ville_naissance               TEXT,
    date_naissance                DATE,
    departement_nom               TEXT,
    departement_code              TEXT,
    circo                         INTEGER,
    date_prise_fonction           DATE,
    profession                    TEXT,
    mail                          TEXT,
    twitter                       TEXT,
    facebook                      TEXT,
    website                       TEXT,
    nombre_mandats                INTEGER,
    score_participation           REAL,
    score_participation_specialite REAL,
    score_loyaute                 REAL,
    score_majorite                REAL,
    date_maj                      DATE,
    photo                         TEXT,
    retire                        INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (groupe_abrev) REFERENCES groupes(abrev)
);

CREATE TABLE IF NOT EXISTS articles (
    slug               TEXT PRIMARY KEY,
    titre              TEXT NOT NULL,
    titre_court        TEXT NOT NULL,
    numero_proposition INTEGER,
    date               DATE,
    lien               TEXT,
    clean_authors      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS article_tags (
    article_slug TEXT NOT NULL,
    tag          TEXT NOT NULL,
    PRIMARY KEY (article_slug, tag),
    FOREIGN KEY (article_slug) REFERENCES articles(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_etapes (
    article_slug TEXT    NOT NULL,
    ordre        INTEGER NOT NULL,
    nom          TEXT,
    date         TEXT,
    statut       TEXT,
    PRIMARY KEY (article_slug, ordre),
    FOREIGN KEY (article_slug) REFERENCES articles(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_auteurs (
    article_slug TEXT    NOT NULL,
    ordre        INTEGER NOT NULL,
    nom_brut     TEXT    NOT NULL,
    depute_id    TEXT,
    PRIMARY KEY (article_slug, ordre),
    FOREIGN KEY (article_slug) REFERENCES articles(slug) ON DELETE CASCADE,
    FOREIGN KEY (depute_id)    REFERENCES deputes(id)
);

CREATE INDEX IF NOT EXISTS idx_deputes_groupe        ON deputes(groupe_abrev);
CREATE INDEX IF NOT EXISTS idx_article_auteurs_slug  ON article_auteurs(article_slug);
CREATE INDEX IF NOT EXISTS idx_article_auteurs_dep   ON article_auteurs(depute_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_slug     ON article_tags(article_slug);
