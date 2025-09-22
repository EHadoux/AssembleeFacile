#!/usr/bin/env python3
"""
Script pour exporter les 5 plus gros contributeurs depuis la base SQLite
vers un fichier JSON que Hugo peut consommer.
"""

import sqlite3
import json
import os
import argparse
from pathlib import Path


def get_top_contributors(db_path, groupes_csv_path, limit=5):
    """
    Récupère les top contributeurs avec leurs informations de parti
    
    Args:
        db_path (str): Chemin vers la base de données SQLite
        groupes_csv_path (str): Chemin vers le fichier CSV des groupes (pour les couleurs)
        limit (int): Nombre de contributeurs à retourner
        
    Returns:
        list: Liste des contributeurs avec leurs informations
    """
    
    # Charger les couleurs des groupes depuis le CSV
    groupes_colors = {}
    try:
        import csv
        with open(groupes_csv_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            for row in csv_reader:
                groupes_colors[row['groupeAbrev']] = {
                    'nom_complet': row['groupe'],
                    'couleur': row['couleur']
                }
    except Exception as e:
        print(f"Attention: Impossible de charger les couleurs des groupes: {e}")
    
    # Connexion à la base de données
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Requête SQL optimisée avec GROUP BY + COUNT
        query = """
        SELECT 
            a.prenom || ' ' || a.nom as nom_complet,
            a.parti_code,
            p.nom_complet as parti_nom,
            COUNT(*) as nb_propositions
        FROM article_auteurs aa
        JOIN auteurs a ON aa.auteur_id = a.id
        JOIN partis p ON a.parti_code = p.code_abrege
        GROUP BY a.id, a.prenom, a.nom, a.parti_code, p.nom_complet
        ORDER BY nb_propositions DESC
        LIMIT ?
        """
        
        cursor.execute(query, (limit,))
        results = cursor.fetchall()
        
        # Formatage des résultats
        contributors = []
        for row in results:
            nom_complet, parti_code, parti_nom, nb_propositions = row
            
            # Récupération de la couleur depuis le CSV
            couleur = None
            if parti_code in groupes_colors:
                couleur = groupes_colors[parti_code]['couleur']
            
            contributor = {
                'nom': nom_complet,
                'count': nb_propositions,
                'groupe': parti_nom,
                'couleur': couleur
            }
            contributors.append(contributor)
        
        conn.close()
        return contributors
        
    except sqlite3.Error as e:
        print(f"Erreur SQLite: {e}")
        return []
    except Exception as e:
        print(f"Erreur inattendue: {e}")
        return []


def get_party_stats(db_path, groupes_csv_path):
    """
    Récupère les statistiques par parti politique
    
    Args:
        db_path (str): Chemin vers la base de données SQLite
        groupes_csv_path (str): Chemin vers le fichier CSV des groupes (pour les couleurs)
        
    Returns:
        list: Liste des partis avec leurs statistiques
    """
    
    # Charger les couleurs des groupes depuis le CSV
    groupes_colors = {}
    try:
        import csv
        with open(groupes_csv_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            for row in csv_reader:
                groupes_colors[row['groupeAbrev']] = {
                    'nom_complet': row['groupe'],
                    'couleur': row['couleur']
                }
    except Exception as e:
        print(f"Attention: Impossible de charger les couleurs des groupes: {e}")
    
    # Connexion à la base de données
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Requête SQL optimisée pour compter les propositions par parti
        # Utilise DISTINCT pour éviter de compter plusieurs fois la même proposition
        query = """
        SELECT 
            p.nom_complet as parti_nom,
            p.code_abrege as parti_code,
            COUNT(DISTINCT aa.article_id) as nb_propositions
        FROM article_auteurs aa
        JOIN auteurs a ON aa.auteur_id = a.id
        JOIN partis p ON a.parti_code = p.code_abrege
        GROUP BY p.code_abrege, p.nom_complet
        ORDER BY nb_propositions DESC
        """
        
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Formatage des résultats
        party_stats = []
        for row in results:
            parti_nom, parti_code, nb_propositions = row
            
            # Récupération de la couleur depuis le CSV
            couleur = None
            if parti_code in groupes_colors:
                couleur = groupes_colors[parti_code]['couleur']
            
            party = {
                'nom': parti_nom,
                'count': nb_propositions,
                'couleur': couleur
            }
            party_stats.append(party)
        
        conn.close()
        return party_stats
        
    except sqlite3.Error as e:
        print(f"Erreur SQLite: {e}")
        return []
    except Exception as e:
        print(f"Erreur inattendue: {e}")
        return []


def export_to_json(contributors, party_stats, output_path):
    """
    Exporte les contributeurs et statistiques par parti vers un fichier JSON
    
    Args:
        contributors (list): Liste des contributeurs
        party_stats (list): Liste des statistiques par parti
        output_path (str): Chemin de sortie du fichier JSON
    """
    try:
        # Créer le répertoire de sortie si nécessaire
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Structure JSON avec métadonnées
        data = {
            'generated_at': __import__('datetime').datetime.now().isoformat(),
            'top_contributors': contributors,
            'party_stats': party_stats,
            'contributors_count': len(contributors),
            'parties_count': len(party_stats)
        }
        
        with open(output_path, 'w', encoding='utf-8') as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
        
        print(f"✅ Fichier JSON généré: {output_path}")
        print(f"📊 {len(contributors)} contributeurs et {len(party_stats)} partis exportés")
        
        # Affichage du résumé des contributeurs
        print("\n🏆 Top contributeurs:")
        for i, contrib in enumerate(contributors, 1):
            print(f"  {i}. {contrib['nom']} ({contrib['count']} propositions) - {contrib['groupe']}")
        
        # Affichage du résumé des partis
        print(f"\n🎭 Top 5 partis par propositions:")
        for i, party in enumerate(party_stats[:5], 1):
            print(f"  {i}. {party['nom']} ({party['count']} propositions)")
        
    except Exception as e:
        print(f"Erreur lors de l'export JSON: {e}")


def main():
    """Fonction principale avec CLI"""
    parser = argparse.ArgumentParser(
        description="Exporte les top contributeurs depuis SQLite vers JSON",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples d'utilisation:
  python export_top_contributors.py
  python export_top_contributors.py --limit 10
  python export_top_contributors.py --output /path/to/custom.json
        """
    )
    
    parser.add_argument(
        '--db-path',
        default='../db/assemblee.db',
        help='Chemin vers la base de données SQLite (défaut: %(default)s)'
    )
    
    parser.add_argument(
        '--groupes-csv',
        default='../assets/groupes.csv',
        help='Chemin vers le fichier CSV des groupes (défaut: %(default)s)'
    )
    
    parser.add_argument(
        '--output',
        default='../data/top_contributors.json',
        help='Chemin de sortie du fichier JSON (défaut: %(default)s)'
    )
    
    parser.add_argument(
        '--limit',
        type=int,
        default=5,
        help='Nombre de contributeurs à exporter (défaut: %(default)s)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Affichage détaillé des opérations'
    )
    
    # Parse des arguments
    args = parser.parse_args()
    
    # Vérifications
    if not os.path.exists(args.db_path):
        print(f"❌ Erreur: La base de données {args.db_path} n'existe pas")
        return 1
    
    if not os.path.exists(args.groupes_csv):
        print(f"⚠️  Attention: Le fichier {args.groupes_csv} n'existe pas (couleurs non disponibles)")
    
    if args.verbose:
        print(f"📊 Base de données: {args.db_path}")
        print(f"🎨 Fichier groupes: {args.groupes_csv}")
        print(f"📄 Sortie JSON: {args.output}")
        print(f"🔢 Limite: {args.limit}")
    
    # Récupération des contributeurs
    contributors = get_top_contributors(args.db_path, args.groupes_csv, args.limit)
    
    if not contributors:
        print("❌ Aucun contributeur trouvé")
        return 1
    
    # Récupération des statistiques par parti
    party_stats = get_party_stats(args.db_path, args.groupes_csv)
    
    if not party_stats:
        print("⚠️  Aucune statistique de parti trouvée")
    
    # Export vers JSON
    export_to_json(contributors, party_stats, args.output)
    
    return 0


if __name__ == "__main__":
    exit(main())