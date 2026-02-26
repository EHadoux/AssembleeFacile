# Guide d'affichage des déclarations d'intérêts des députés

Ce document explique comment parser et afficher les fichiers XML de déclarations d'intérêts et d'activités (DIA) sur la page auteur d'un député.

---

## Nature des fichiers et logique de versions

Chaque fichier `assets/declarations/deputes/PA{id}.xml` peut contenir **plusieurs `<declaration>`** à la racine. Deux cas coexistent.

### Cas 1 — Déclarations modificatives

La plus courante : une déclaration initiale suivie de 1 à N déclarations modificatives (`<declarationModificative>true</declarationModificative>`).

**Les modificatives sont des remplacements section par section, pas des deltas d'items.** Quand une section apparaît dans une modificative, elle contient l'intégralité du nouvel état de cette section (tous les items actuels, pas seulement les ajouts/suppressions). Les sections absentes d'une modificative sont inchangées.

Exemple réel (PA841681) :

- Déclaration initiale : 2 mandats électifs, 1 participation dirigeante, 4 collaborateurs
- Modificative #1 : `mandatElectifDto` passe à néant (mandats terminés), `participationDirigeantDto` = 2 items (rôle PS corrigé + nouvelle SCI ajoutée), collaborateurs inchangés
- Modificatives #2 et #3 : uniquement les collaborateurs changent à chaque fois

**Le champ `motif` est TOUJOURS `CREATION` sur tous les items**, y compris dans les modificatives — il ne permet pas d'identifier ce qui a changé.

Pour reconstituer l'état actuel : partir de la déclaration initiale, puis appliquer chaque modificative dans l'ordre chronologique en remplaçant section par section.

### Cas 2 — Multiples déclarations initiales

Plus rare : plusieurs déclarations avec `<declarationModificative>false</declarationModificative>`. La plus récente est un re-dépôt complet (souvent une correction de fond : reclassification d'items entre sections, ajout d'historique antérieur au mandat). Elle remplace intégralement la précédente.

### Algorithme de reconstruction par snapshot

Dans les deux cas, on calcule une liste ordonnée de **snapshots** : chaque snapshot représente l'état complet de la déclaration tel qu'il aurait été visible à la date de ce dépôt, après application de tous les dépôts précédents.

```
snapshots = []
état_courant = {}   // map section → items (vide au départ)

pour chaque declaration dans l'ordre chronologique :
  si declarationModificative = false :
    état_courant = toutes les sections de cette declaration  // remplacement total
  sinon :
    pour chaque section présente dans cette declaration :
      état_courant[section] = section de cette declaration  // remplacement section par section
      // les sections absentes restent inchangées
  snapshots.append({ date: dateDepot, état: copie(état_courant) })
```

Le dernier snapshot est l'état courant affiché par défaut.

Consulter une version antérieure = afficher le snapshot correspondant dans cet état reconstitué, **pas le XML brut de cette déclaration seule**. Par exemple, si la modificative #2 n'a touché que les collaborateurs, la vue « version #2 » montrera quand même les mandats et participations tels qu'ils avaient été établis par la modificative #1.

### Stratégie d'affichage

1. **Afficher le dernier snapshot** en vue principale, en indiquant la date du dernier dépôt.
2. **Offrir un accès à l'historique dans les deux cas** (modificatives ou re-dépôts complets) : sélecteur de version « Déposée le dd/mm/yyyy » pour chaque snapshot. Afficher le snapshot reconstitué à cette date, pas le contenu brut du dépôt isolé.
3. **Mettre en évidence les changements** entre deux snapshots consécutifs si possible (sections modifiées, items ajoutés/supprimés), pour que les citoyens voient immédiatement ce qui a changé d'une version à l'autre.

C'est essentiel pour la transparence : une information peut disparaître discrètement dans une modificative ne touchant en apparence qu'une autre section — l'historique reconstitué le rend visible.

---

## Champs à ignorer

- `<motif><id>CREATION</id></motif>` : présent sur tous les items, sans valeur affichable.
- `<attachedFiles>` : références internes au téléservice.
- `<uuid>`, `<origine>`, `<declarationVersion>` : métadonnées techniques.
- `<email>`, `<telephoneDec>`, `<adresseDec>`, `<nomConjoint>`, `<nomEmployeur>` quand ils contiennent `[Données non publiées]` : ne pas afficher.
- `<conservee>` : champ interne indiquant si l'activité continuera après le mandat. Peut éventuellement être affiché comme une pastille « en cours » / « terminé ».

---

## Structure de chaque section

Chaque section suit ce schéma commun :

```xml
<xxxDto>
  <items>
    <items>  <!-- chaque <items> enfant = un enregistrement -->
      ...
    </items>
  </items>
  <neant>true|false</neant>
</xxxDto>
```

**Règle absolue** : si `<neant>true</neant>`, ne pas afficher la section du tout.

Les montants de rémunération sont des chaînes libres avec espaces possibles (`"35 600"`, `"35600"`) — les normaliser avant affichage : `parseInt(str.replace(/\s/g, ''))`.

---

## Groupes d'affichage recommandés

### Groupe 1 — Informations de contexte

_Source : `<general>`_

| Champ XML                         | Affichage                                    |
| --------------------------------- | -------------------------------------------- |
| `dateDepot`                       | Date de dépôt (format `DD/MM/YYYY HH:mm:ss`) |
| `declarationModificative`         | Badge « Déclaration modificative » si `true` |
| `general/declarant/dateNaissance` | Date de naissance                            |
| `general/regimeMatrimonial`       | Régime matrimonial (souvent vide)            |
| `general/organe/labelOrgane`      | Département d'élection, ex. `Cantal(15)`     |
| `general/dateDebutMandat`         | Date de début du mandat actuel               |

Ne jamais afficher adresse, email, téléphone (toujours `[Données non publiées]`).

---

### Groupe 2 — Activités professionnelles

_Ce groupe couvre les activités rémunérées ou passées du député et de son conjoint._

#### 2a — Activités de consultant/conseil

_Source : `activConsultantDto`_

Champs par item :

- `nomEmployeur` : cabinet ou client (parfois masqué)
- `description` : description de la mission
- `dateDebut` / `dateFin` : période (format `MM/YYYY`)
- `remuneration/brutNet` : `Brut` ou `Net`
- `remuneration/montant/montant[]` : liste de `{annee, montant}` — rémunération annuelle

**Affichage suggéré** : carte avec titre = description, sous-titre = employeur, badge Brut/Net, tableau années → montants.

#### 2b — Activités professionnelles (5 dernières années)

_Source : `activProfCinqDerniereDto`_

Champs par item :

- `description` : intitulé du poste
- `employeur` : nom de l'employeur (parfois masqué)
- `dateDebut` / `dateFin`
- `remuneration` : même structure que 2a

**Affichage suggéré** : identique à 2a. Ces deux sous-sections peuvent être fusionnées visuellement sous « Expérience professionnelle ».

#### 2c — Activité professionnelle du conjoint

_Source : `activProfConjointDto`_

Champs par item :

- `employeurConjoint` : employeur (parfois masqué)
- `activiteProf` : description de l'activité

Le nom du conjoint est systématiquement `[Données non publiées]` — ne pas afficher.

**Affichage suggéré** : ligne simple ou tag discret « Conjoint : [activité] chez [employeur] ».

---

### Groupe 3 — Mandats et engagements

_Ce groupe couvre toutes les fonctions électives, associatives ou de gouvernance._

#### 3a — Mandats électifs

_Source : `mandatElectifDto`_

Champs par item :

- `descriptionMandat` : libellé libre (« Député », « Conseiller municipal Ally », « Conseiller départemental »…)
- `dateDebut` / `dateFin`
- `remuneration` : liste annuelle

**Affichage suggéré** : timeline ou liste de badges. Mettre en avant le mandat « Député » avec la rémunération annuelle. Les mandats locaux à 0 € peuvent être regroupés ou affichés en secondaire.

#### 3b — Participations et fonctions dirigeantes

_Source : `participationDirigeantDto`_

Champs par item :

- `nomSociete` : nom de l'organisme (association, SEM, hôpital, syndicat intercommunal…)
- `activite` : rôle (« Président », « Membre », « Secrétaire général »…)
- `dateDebut` / `dateFin`
- `remuneration` : souvent 0 €

**Affichage suggéré** : liste compacte avec `nomSociete` + `activite` + période. Masquer ou griser les entrées à rémunération nulle sur toutes les années.

#### 3c — Participations financières dans des sociétés

_Source : `participationFinanciereDto`_

Champs par item :

- `nomSociete` : parfois masqué (`[Données non publiées]`)
- `evaluation` : valeur en euros (entier)
- `capitalDetenu` : % du capital
- `nombreParts` : nombre de parts
- `remuneration` : revenus tirés (souvent 0)
- `actiConseil` : `Oui`/`Non` (activité de conseil dans cette société)

**Affichage suggéré** : tableau ou carte avec `nomSociete`, `capitalDetenu %`, `evaluation €`. Annoter si `actiConseil = Oui`.

#### 3d — Fonctions bénévoles

_Source : `fonctionBenevoleDto`_

Champs par item :

- `nomStructure` : nom de l'association/fondation
- `descriptionActivite` : rôle bénévole

**Affichage suggéré** : liste de tags ou puces simples.

---

### Groupe 4 — Collaborateurs parlementaires

_Source : `activCollaborateursDto`_

Champs par item :

- `nom` : nom complet du collaborateur
- `employeur` : parfois le nom du député lui-même
- `descriptionActivite` : rôle (« Collaboratrice », « Assistant »…)

**Affichage suggéré** : liste de noms avec rôle. Section discrète (intérêt civique limité mais utile pour la transparence).

---

### Groupe 5 — Observations libres

_Source : `observationInteretDto`_

Champs par item :

- `contenu` : texte libre du déclarant (parfois masqué)

**Affichage suggéré** : bloc de texte en italique avec icône « note ». Afficher seulement si `contenu` n'est pas masqué.

---

## Ce qui N'est PAS présent dans ces fichiers

Les fichiers disponibles sont tous de type **DIA** (Déclaration d'intérêts et d'activités). Le schéma JSON de référence décrit également des sections de **DDP** (Déclaration de patrimoine) qui n'apparaissent pas dans ces XML :

- Immeubles bâtis/non bâtis (`immeubleDto`)
- Parts de SCI (`sciDto`)
- Valeurs mobilières cotées/non cotées (`valeursEnBourseDto`, `valeursNonEnBourseDto`)
- Assurances vie (`assuranceVieDto`)
- Comptes bancaires (`comptesBancaireDto`)
- Biens mobiliers divers, véhicules, fonds de commerce, biens à l'étranger
- Passif / dettes (`passifDto`)
- Revenus par catégorie depuis le début du mandat (`revenuMandatDto`)

Ne pas implémenter ces sections pour l'instant — ignorer les nœuds XML correspondants s'ils apparaissent.

---

## Recommandations UI générales

1. **Sections vides = sections cachées** : si `<neant>true</neant>`, ne pas rendre la section ni son titre.
2. **Rémunérations à 0 €** : griser ou regrouper les entrées dont tous les montants sont nuls. Elles indiquent un mandat bénévole.
3. **Données masquées** : si une valeur est `[Données non publiées]`, afficher « — » ou rien.
4. **Montants** : formater en euros avec séparateur millier (`35 600 €`). Préciser si Brut ou Net.
5. **Périodes** : afficher `MM/YYYY → MM/YYYY`, ou `MM/YYYY → en cours` si `dateFin` est vide.
6. **Déclarations multiples** : afficher seulement la plus récente. Si modificative, montrer un badge « Mise à jour » avec la date.
7. **Ordre d'affichage** : Contexte → Activités pro → Mandats & engagements → Collaborateurs → Observations.
