# Tâches en attente

> Ces tâches concernent la **nouvelle version SvelteKit dans `app/`**, pas la version originale à la racine du projet.

1. ~~**Lenteur de navigation** — En page 2, cliquer sur "Page précédente" ou sur "AssembléeFacile" dans le header prend trop de temps. Probablement des calculs faits à la volée plutôt que précalculés à la compilation.~~ → Faux problème : lenteur inhérente au mode dev Vite (800+ fichiers .md chargés un par un). En production : ~100ms.

2. **Pagination** — La navigation page par page n'est pas pratique. Ajouter des numéros de pages cliquables en plus des boutons précédent/suivant.

3. **Copyright dans le footer** — Le footer ne contient pas de mention de copyright au nom du propriétaire.

4. ~~**Lenteur de la page des auteurs** — La liste des auteurs est très lente à charger (même cause probable que #1).~~ → Même cause que #1 : artefact du mode dev Vite uniquement.

5. **Photos des députés sur la page des auteurs** — Remplacer la première lettre du nom par la vraie photo du député.

6. **Page d'un député incomplète** — La page de détail d'un député manque beaucoup d'informations par rapport à la version originale.

7. **Répartition politique des signataires** — La page d'une proposition ne montre pas la répartition par groupe politique des signataires, contrairement à la version originale.

8. **Retour arrière sur la page d'une proposition** — Il n'y a pas de moyen de revenir à la page précédente depuis la page d'une proposition.

9. **Liste des signataires en colonne unique** — Afficher les signataires sur plusieurs colonnes plutôt qu'une seule colonne à droite, ce qui crée une page inutilement longue.

10. **Numéro de proposition non fonctionnel** — Le numéro affiché sur la page d'une proposition ne fonctionne pas (ex: `perennisation-du-dispositif-dencadrement-des-loyers-mis-en-place-par-la-loi-n-2018-1021-23-novembre-portant-evolution-logement-de-lamenagement-et-numerique-1624`).

11. ~~**Fuzzy matching des noms d'auteurs** — Les noms dans les fichiers markdown viennent d'un LLM et contiennent des variantes imparfaites. Implémenter un fuzzy matching pour les réconcilier avec les noms canoniques du CSV.~~ → Base SQLite créée (`app/db/`), scripts `db:seed-deputes`, `db:seed-articles`, `db:clean-authors`. 574 députés, 1049 articles en base, noms nettoyés dans les .md.
