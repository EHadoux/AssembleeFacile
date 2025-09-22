-- =================================================================
-- Script de création et mise à jour de la base de données SQLite
-- AssembléeFacile - Partis, Auteurs et Articles
-- =================================================================

-- Activation des clés étrangères
PRAGMA foreign_keys = ON;

-- =================================================================
-- TABLE DES PARTIS POLITIQUES
-- =================================================================
CREATE TABLE IF NOT EXISTS partis (
    code_abrege TEXT PRIMARY KEY,
    nom_complet TEXT NOT NULL
);

-- =================================================================
-- TABLE DES LÉGISLATURES
-- =================================================================
CREATE TABLE IF NOT EXISTS legislatures (
    numero INTEGER PRIMARY KEY,
    date_debut DATE NOT NULL,
    date_fin DATE
);

-- =================================================================
-- TABLE DES AUTEURS (DÉPUTÉS)
-- =================================================================
CREATE TABLE IF NOT EXISTS auteurs (
    id TEXT PRIMARY KEY,
    legislature INTEGER NOT NULL,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    parti_code TEXT NOT NULL,
    
    -- Clés étrangères
    FOREIGN KEY (parti_code) REFERENCES partis(code_abrege),
    FOREIGN KEY (legislature) REFERENCES legislatures(numero),
    
    -- Contrainte : un auteur ne peut appartenir qu'à un seul parti par législature
    UNIQUE (id, legislature)
);

-- =================================================================
-- TABLE DES ARTICLES (PROPOSITIONS DE LOI)
-- =================================================================
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    date_publication DATE NOT NULL,
    derniere_modification DATE NOT NULL,
    categorie_une TEXT NOT NULL,
    categorie_deux TEXT NOT NULL,
    categorie_trois TEXT NOT NULL
);

-- =================================================================
-- TABLE DE LIAISON ARTICLES-AUTEURS
-- =================================================================
CREATE TABLE IF NOT EXISTS article_auteurs (
    article_id INTEGER NOT NULL,
    auteur_id TEXT NOT NULL,
    ordre INTEGER DEFAULT 1, -- ordre d'apparition dans la liste des auteurs
    
    PRIMARY KEY (article_id, auteur_id),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (auteur_id) REFERENCES auteurs(id) ON DELETE CASCADE
);

-- =================================================================
-- INDEX POUR LES PERFORMANCES
-- =================================================================

-- Index sur les clés étrangères
CREATE INDEX IF NOT EXISTS idx_article_auteurs_article_id ON article_auteurs(article_id);
CREATE INDEX IF NOT EXISTS idx_article_auteurs_auteur_id ON article_auteurs(auteur_id);

-- =================================================================
-- COMMENTAIRES DE MAINTENANCE
-- =================================================================

-- Pour ajouter un parti :
-- INSERT INTO partis (code_abrege, nom_complet) VALUES ('CODE', 'Nom Complet');

-- Pour ajouter un auteur :
-- INSERT INTO auteurs (id, legislature, nom, prenom, parti_code, ...) VALUES (...);

-- Pour ajouter un article avec ses relations :
-- 1. INSERT INTO articles (...);
-- 2. INSERT INTO article_auteurs (article_id, auteur_id, ordre) VALUES (...);