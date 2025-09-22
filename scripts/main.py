import sqlite3
import csv
import os
import argparse
import toml
import re
from datetime import datetime
from pathlib import Path

def import_groupes_to_db(csv_path, db_path):
    """
    Importe les groupes politiques depuis le fichier CSV vers la base de données SQLite.
    
    Args:
        csv_path (str): Chemin vers le fichier groupes.csv
        db_path (str): Chemin vers la base de données SQLite
    """
    try:
        # Connexion à la base de données
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Lecture du fichier CSV
        with open(csv_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            
            # Compteur pour le suivi
            count = 0
            
            for row in csv_reader:
                # Extraction des données
                code_abrege = row['groupeAbrev'].strip()
                nom_complet = row['groupe'].strip()
                
                # Insertion dans la table partis (en ignorant les doublons)
                cursor.execute('''
                    INSERT OR IGNORE INTO partis (code_abrege, nom_complet)
                    VALUES (?, ?)
                ''', (code_abrege, nom_complet))
                
                count += 1
                print(f"Importé: {code_abrege} - {nom_complet}")
        
        # Validation des changements
        conn.commit()
        print(f"\nImportation terminée: {count} groupes traités")
        print(f"Nombre total de partis en base: {cursor.execute('SELECT COUNT(*) FROM partis').fetchone()[0]}")
        
    except FileNotFoundError:
        print(f"Erreur: Le fichier {csv_path} n'a pas été trouvé")
    except sqlite3.Error as e:
        print(f"Erreur SQLite: {e}")
    except Exception as e:
        print(f"Erreur inattendue: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

def import_auteurs_to_db(csv_path, db_path):
    """
    Importe les auteurs (députés) depuis le fichier CSV vers la base de données SQLite.
    
    Args:
        csv_path (str): Chemin vers le fichier deputes-active.csv
        db_path (str): Chemin vers la base de données SQLite
    """
    try:
        # Connexion à la base de données
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Lecture du fichier CSV
        with open(csv_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            
            # Compteur pour le suivi
            count = 0
            errors = 0
            
            for row in csv_reader:
                try:
                    # Extraction des données
                    auteur_id = row['id'].strip()
                    legislature = 17
                    nom = row['nom'].strip()
                    prenom = row['prenom'].strip()
                    parti_code = row['groupeAbrev'].strip()
                    
                    # Insertion dans la table auteurs (en ignorant les doublons)
                    cursor.execute('''
                        INSERT OR IGNORE INTO auteurs (id, legislature, nom, prenom, parti_code)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (auteur_id, legislature, nom, prenom, parti_code))
                    
                    count += 1
                    print(f"Importé: {auteur_id} - {prenom} {nom} ({parti_code})")
                    
                except Exception as e:
                    errors += 1
                    print(f"Erreur lors de l'import de {row.get('id', 'ID inconnu')}: {e}")
        
        # Validation des changements
        conn.commit()
        print(f"\nImportation terminée: {count} auteurs traités")
        if errors > 0:
            print(f"Erreurs rencontrées: {errors}")
        print(f"Nombre total d'auteurs en base: {cursor.execute('SELECT COUNT(*) FROM auteurs').fetchone()[0]}")
        
    except FileNotFoundError:
        print(f"Erreur: Le fichier {csv_path} n'a pas été trouvé")
    except sqlite3.Error as e:
        print(f"Erreur SQLite: {e}")
    except Exception as e:
        print(f"Erreur inattendue: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

def parse_markdown_frontmatter(file_path):
    """
    Parse le frontmatter TOML d'un fichier Markdown.
    
    Args:
        file_path (str): Chemin vers le fichier Markdown
        
    Returns:
        dict: Métadonnées extraites du frontmatter
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            
        # Recherche du frontmatter TOML entre les +++
        frontmatter_match = re.match(r'^\+\+\+\n(.*?)\n\+\+\+', content, re.DOTALL)
        if not frontmatter_match:
            return None
            
        frontmatter_content = frontmatter_match.group(1)
        metadata = toml.loads(frontmatter_content)
        
        return metadata
        
    except Exception as e:
        print(f"Erreur lors du parsing de {file_path}: {e}")
        return None

def extract_proposal_number(filename):
    """
    Extrait le numéro de proposition depuis le nom du fichier.
    
    Args:
        filename (str): Nom du fichier (ex: "lutter-contre-fraude-n-1234.md")
        
    Returns:
        int or None: Numéro de proposition ou None si non trouvé
    """
    match = re.search(r'-n-(\d+)\.md$', filename)
    if match:
        return int(match.group(1))
    return None

def import_articles_to_db(posts_dir, db_path):
    """
    Importe les articles depuis les fichiers Markdown vers la base de données SQLite.
    
    Args:
        posts_dir (str): Chemin vers le dossier content/posts
        db_path (str): Chemin vers la base de données SQLite
    """
    try:
        # Connexion à la base de données
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Parcours de tous les fichiers Markdown
        posts_path = Path(posts_dir)
        if not posts_path.exists():
            print(f"Erreur: Le dossier {posts_dir} n'existe pas")
            return
            
        md_files = list(posts_path.glob("*.md"))
        if not md_files:
            print(f"Aucun fichier Markdown trouvé dans {posts_dir}")
            return
            
        count = 0
        errors = 0
        skipped = 0
        
        for md_file in md_files:
            try:    
                # Parse du frontmatter
                metadata = parse_markdown_frontmatter(md_file)
                if not metadata:
                    skipped += 1
                    continue
                
                # Extraction des données obligatoires
                titre = metadata.get('title', '').strip()
                date_str = metadata.get('date', '')
                # Id est à la fin du titre, après - N° 
                id = int(titre.split('- N°')[-1].strip()) if '- N°' in titre else None

                if not titre or not date_str:
                    print(f"Métadonnées manquantes dans {md_file.name}")
                    skipped += 1
                    continue
                
                # Conversion de la date
                if isinstance(date_str, str):
                    date_publication = datetime.strptime(date_str, '%Y-%m-%d').date()
                else:
                    date_publication = date_str.date() if hasattr(date_str, 'date') else date_str
                
                # Extraction des catégories depuis les tags
                tags = metadata.get('tags', [])
                if not isinstance(tags, list):
                    tags = []
                
                # Assignation des catégories (padding avec des chaînes vides si nécessaire)
                categorie_une = tags[0] if len(tags) > 0 else ''
                categorie_deux = tags[1] if len(tags) > 1 else ''
                categorie_trois = tags[2] if len(tags) > 2 else ''
                
                # Date de modification (utilise la date de publication par défaut)
                derniere_modification = date_publication
                
                # Insertion de l'article
                if id is None:
                    cursor.execute('''
                    INSERT OR IGNORE INTO articles (titre, date_publication, derniere_modification, 
                                        categorie_une, categorie_deux, categorie_trois)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (titre, date_publication, derniere_modification, 
                      categorie_une, categorie_deux, categorie_trois))                
                    article_id = cursor.lastrowid
                else:
                    cursor.execute('''
                    INSERT OR IGNORE INTO articles (id, titre, date_publication, derniere_modification, 
                                        categorie_une, categorie_deux, categorie_trois)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (id, titre, date_publication, derniere_modification, 
                      categorie_une, categorie_deux, categorie_trois))                
                    article_id = id
                
                # Traitement des auteurs
                auteurs = metadata.get('auteurs', [])
                if isinstance(auteurs, list) and auteurs:
                    for ordre, auteur_nom in enumerate(auteurs, 1):
                        auteur_nom = auteur_nom.strip()
                        if not auteur_nom:
                            continue
                            
                        # Recherche de l'auteur dans la base par nom complet
                        cursor.execute('''
                            SELECT id FROM auteurs 
                            WHERE TRIM(prenom || ' ' || nom) = ? 
                            OR TRIM(nom || ' ' || prenom) = ?
                            LIMIT 1
                        ''', (auteur_nom, auteur_nom))
                        
                        auteur_result = cursor.fetchone()
                        if auteur_result:
                            auteur_id = auteur_result[0]
                            
                            # Insertion de la relation article-auteur
                            cursor.execute('''
                                INSERT OR IGNORE INTO article_auteurs (article_id, auteur_id, ordre)
                                VALUES (?, ?, ?)
                            ''', (article_id, auteur_id, ordre))
                        else:
                            print(f"Auteur non trouvé: {auteur_nom} (article: {titre})")
                
                count += 1
                proposal_num = extract_proposal_number(md_file.name)
                if proposal_num:
                    print(f"Importé: N°{proposal_num} - {titre} ({len(auteurs)} auteurs)")
                else:
                    print(f"Importé: {titre} ({len(auteurs)} auteurs)")
                
            except Exception as e:
                errors += 1
                print(f"Erreur lors de l'import de {md_file.name}: {e}")
        
        # Validation des changements
        conn.commit()
        print(f"\nImportation terminée:")
        print(f"- {count} articles importés")
        print(f"- {skipped} fichiers ignorés")
        if errors > 0:
            print(f"- {errors} erreurs rencontrées")
        print(f"- Nombre total d'articles en base: {cursor.execute('SELECT COUNT(*) FROM articles').fetchone()[0]}")
        print(f"- Nombre total de relations auteur-article: {cursor.execute('SELECT COUNT(*) FROM article_auteurs').fetchone()[0]}")
        
    except Exception as e:
        print(f"Erreur inattendue: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

def main():
    """Fonction principale avec CLI pour l'import"""
    parser = argparse.ArgumentParser(
        description="Importe les données depuis les fichiers sources vers la base de données SQLite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples d'utilisation:
  python main.py import-groupes
  python main.py import-groupes --csv-path /chemin/vers/groupes.csv
  python main.py import-groupes --db-path /chemin/vers/ma_base.db
  
  python main.py import-auteurs
  python main.py import-auteurs --csv-path /chemin/vers/deputes-active.csv
  
  python main.py import-articles
  python main.py import-articles --posts-dir /chemin/vers/posts
  python main.py import-articles --verbose
        """
    )
    
    # Sous-commandes
    subparsers = parser.add_subparsers(dest='command', help='Commandes disponibles')
    
    # Sous-commande pour l'import des groupes
    import_parser = subparsers.add_parser(
        'import-groupes', 
        help='Importe les groupes politiques depuis le CSV'
    )
    
    import_parser.add_argument(
        '--csv-path',
        default='../assets/groupes.csv',
        help='Chemin vers le fichier CSV des groupes (défaut: %(default)s)'
    )
    
    import_parser.add_argument(
        '--db-path',
        default='../db/assemblee.db',
        help='Chemin vers la base de données SQLite (défaut: %(default)s)'
    )
    
    import_parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Affichage détaillé des opérations'
    )
    
    # Sous-commande pour l'import des auteurs
    auteurs_parser = subparsers.add_parser(
        'import-auteurs', 
        help='Importe les auteurs (députés) depuis le CSV'
    )
    
    auteurs_parser.add_argument(
        '--csv-path',
        default='../assets/deputes-active.csv',
        help='Chemin vers le fichier CSV des députés (défaut: %(default)s)'
    )
    
    auteurs_parser.add_argument(
        '--db-path',
        default='../db/assemblee.db',
        help='Chemin vers la base de données SQLite (défaut: %(default)s)'
    )
    
    auteurs_parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Affichage détaillé des opérations'
    )
    
    # Sous-commande pour l'import des articles
    articles_parser = subparsers.add_parser(
        'import-articles', 
        help='Importe les articles depuis les fichiers Markdown'
    )
    
    articles_parser.add_argument(
        '--posts-dir',
        default='../content/posts',
        help='Chemin vers le dossier des posts (défaut: %(default)s)'
    )
    
    articles_parser.add_argument(
        '--db-path',
        default='../db/assemblee.db',
        help='Chemin vers la base de données SQLite (défaut: %(default)s)'
    )
    
    articles_parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Affichage détaillé des opérations'
    )
    
    # Parse des arguments
    args = parser.parse_args()
    
    # Vérification qu'une commande a été fournie
    if not args.command:
        parser.print_help()
        return
    
    # Exécution de la commande
    if args.command == 'import-groupes':
        # Vérification de l'existence du fichier CSV
        if not os.path.exists(args.csv_path):
            print(f"Erreur: Le fichier {args.csv_path} n'existe pas")
            return
        
        # Création du répertoire de la base de données si nécessaire
        os.makedirs(os.path.dirname(args.db_path), exist_ok=True)
        
        if args.verbose:
            print(f"Import depuis: {args.csv_path}")
            print(f"Vers la base: {args.db_path}")
        
        # Import des groupes
        import_groupes_to_db(args.csv_path, args.db_path)
    
    elif args.command == 'import-auteurs':
        # Vérification de l'existence du fichier CSV
        if not os.path.exists(args.csv_path):
            print(f"Erreur: Le fichier {args.csv_path} n'existe pas")
            return
        
        # Création du répertoire de la base de données si nécessaire
        os.makedirs(os.path.dirname(args.db_path), exist_ok=True)
        
        if args.verbose:
            print(f"Import depuis: {args.csv_path}")
            print(f"Vers la base: {args.db_path}")
        
        # Import des auteurs
        import_auteurs_to_db(args.csv_path, args.db_path)
    
    elif args.command == 'import-articles':
        # Vérification de l'existence du dossier
        if not os.path.exists(args.posts_dir):
            print(f"Erreur: Le dossier {args.posts_dir} n'existe pas")
            return
        
        # Création du répertoire de la base de données si nécessaire
        os.makedirs(os.path.dirname(args.db_path), exist_ok=True)
        
        if args.verbose:
            print(f"Import depuis: {args.posts_dir}")
            print(f"Vers la base: {args.db_path}")
        
        # Import des articles
        import_articles_to_db(args.posts_dir, args.db_path)

if __name__ == "__main__":
    main()