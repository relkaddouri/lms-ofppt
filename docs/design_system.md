# Design System — LMS OFPPT

Identité "tableau de pilotage clair" inspirée d'un dashboard SaaS professionnel (type outil RH) : fond clair, cartes blanches, hiérarchie nette, statuts lisibles au premier coup d'œil. Ça correspond bien à ce que fait l'outil : toi (formateur) tu pilotes des groupes de stagiaires qui avancent par étapes, exactement comme un recruteur pilote des candidats à travers un pipeline. Chaque interface générée doit respecter ces tokens exactement — ne pas improviser de nouvelles couleurs ou polices.

**Deux publics, deux logiques d'écran.** L'espace formateur (desktop, dense, orienté tableau/données) et l'espace stagiaire (mobile, aéré, orienté fil/consultation rapide) partagent la même palette et la même typographie, mais pas la même densité d'information ni les mêmes patterns de navigation — voir la section dédiée "Espace stagiaire" plus bas. Ne jamais transposer un pattern formateur (tableau dense, barre latérale) tel quel côté stagiaire.

## Palette (à utiliser en variables CSS, jamais en valeurs codées en dur)

| Nom | Hex | Usage |
|---|---|---|
| `--forest` | #0E3B2E | Marque, boutons primaires (fond plein), icône active de nav |
| `--mint` | #E6F4EE | Fond des états actifs/survol (nav active, ligne sélectionnée) |
| `--paper` | #F6F7F9 | Fond de page |
| `--surface` | #FFFFFF | Cartes, tableaux, barre latérale |
| `--ink` | #16241F | Texte principal (noms, titres) |
| `--slate` | #6B7280 | Texte secondaire (emails, métadonnées, légendes) |
| `--border` | #E5E7EB | Bordures fines de tableau et de carte |

### Couleurs de statut (texte uniquement, jamais en fond plein)

| Nom | Hex | Usage |
|---|---|---|
| `--status-success` | #1D9A6C | Statut positif (Validé, Fait, Accepté) |
| `--status-danger` | #E0507A | Statut négatif (Rejeté, Échec, Erreur) |
| `--status-neutral` | #6B7280 | Statut neutre/expiré (Expiré, Archivé) |
| `--status-info` | #3B82F6 | Statut en cours (Envoyé, En attente de retour) |

## Typographie

**Chargement obligatoire** : `General Sans` et `Inter` doivent être importées via `next/font` dans `app/layout.tsx` et appliquées globalement (variable CSS + classes), jamais laissées retomber sur la police système par défaut — vérifier ce point avant toute autre retouche visuelle.

- **Titres / display** : `General Sans` (600-700) — titres de page et d'en-tête de section
- **Corps / interface** : `Inter` (400-500) — tout le texte courant, tableaux, formulaires, navigation
- **Données tabulaires** : `IBM Plex Mono` (400), utilisé uniquement pour les colonnes numériques alignées (pourcentages, montants, dates courtes) dans les tableaux — pas ailleurs

Échelle : 12px (légendes, labels de section en majuscules espacées) / 14px (corps, cellules de tableau) / 16px (corps large) / 24px (titres de page) / 28px (titre principal du dashboard).

## Layout

- **Largeur de contenu** : 1200px maximum, centré, padding latéral 32px. Les formulaires (champs de saisie, textarea) sont limités à 640px de large — jamais de contenu étiré sur toute la largeur de la fenêtre.
- **Barre latérale** : 240-260px, fond `--surface`, sections groupées avec labels en majuscules 11px `--slate` espacées (ex. "GESTION", "SUIVI", "AUTRES"), items icône + libellé, item actif sur fond `--mint` avec texte et icône `--forest`
- **Barre supérieure** : titre de page en gras à gauche, cluster d'icônes utilitaires à droite (recherche, notifications avec badge rouge de compteur, avatar de l'utilisateur connecté)
- **Barre d'outils de liste** : champ de recherche avec icône, bouton filtre, bouton tri, bouton principal d'action aligné à droite (fond `--forest`, texte blanc, coins arrondis 8px)
- **Onglets de filtre** : ligne d'onglets texte au-dessus des tableaux (ex. Tous / En cours / Terminé / Archivé), onglet actif en texte `--ink` gras, les autres en `--slate`
- Cartes et tableaux : bordure fine 1px `--border` + ombre légère (`0 1px 3px rgba(0,0,0,0.06)`) pour se détacher clairement du fond `--paper`, coins arrondis 12px

## Élément signature : la ligne d'identité à deux niveaux

Repris directement du modèle de référence : chaque ligne représentant une personne (stagiaire, formateur) affiche un avatar (ou initiales sur fond `--mint` si pas de photo), le nom en `--ink` gras sur la première ligne, et l'information secondaire (email, ou groupe) en `--slate` plus petit juste en dessous. Ce motif s'applique à toute liste de personnes dans l'app : liste de stagiaires, liste de formateurs si multi-comptes.

La colonne de progression réutilise le même principe qu'une colonne "Score" : un pourcentage simple, aligné à droite, en `IBM Plex Mono`, jamais une barre graphique complexe — la clarté du chiffre prime.

## Espace stagiaire — mobile-first (règles spécifiques)

Le stagiaire consulte l'app quasi exclusivement depuis son téléphone (§Espace stagiaire du PRD). Ces écrans suivent des règles différentes de l'espace formateur, pensé lui pour un écran de bureau :

- **Navigation par barre inférieure fixe** (bottom tab bar), pas de barre latérale — 4 onglets maximum : Fil, Devoirs, Contrôles, Emploi du temps. Icône + libellé court, item actif en `--forest` avec un point `--mint` derrière l'icône.
- **Cibles tactiles de 44×44px minimum** sur tout élément interactif (bouton "j'aime", icône de commentaire, item de liste) — jamais de cible plus petite, même pour une icône discrète.
- **Fil d'actualité en cartes empilées**, une annonce = une carte pleine largeur avec padding généreux (16px), séparateur `--border` fin entre cartes plutôt que des cartes flottantes avec ombre (évite l'effet "liste de courses" sur mobile).
- **Réaction "j'aime" et commentaire toujours visibles en bas de carte**, jamais cachés derrière un menu — ce sont les actions principales du fil, elles doivent être atteignables en un tap.
- **Le tag/mention d'un camarade** utilise le symbole `@` suivi d'une liste déroulante filtrée au fur et à mesure de la frappe, le nom taggé apparaît ensuite en `--forest` cliquable dans le texte (pas juste souligné).
- **Priorité au contenu, pas à la densité.** Contrairement à l'espace formateur (dense, orienté tableau), l'espace stagiaire privilégie des blocs aérés, une seule information principale par carte — le stagiaire scanne rapidement entre deux cours, il ne travaille pas dans l'app.

## Calendrier et créneaux — langage visuel

Le calendrier (formateur) doit distinguer visuellement plusieurs états qui ont un sens réglementaire différent (PRD §4.9-4.10) — une différence de couleur ou de style de bordure suffit, mais elle doit être systématique :

- **Bloc matin/soir** : représenté comme un rectangle unique de la durée du bloc (8h30-13h30 ou 13h30-18h30), avec une fine ligne pointillée `--border` à l'endroit de la pause interne (10h45 ou 15h45) — visuellement "un bloc qui respire", pas une vraie coupure.
- **Date de contrôle estimée par l'app** (CC1, CC2, EFM local) : bordure **en pointillés** `--blueprint`-équivalent (`--forest` à 60% d'opacité), fond `--mint` très clair — signale "prévision, pas encore fixée".
- **Date de contrôle confirmée manuellement** (EFM régional saisi) : bordure **pleine** `--forest`, fond `--surface` — signale "date ferme".
- Ne jamais utiliser la même représentation pour ces deux états : c'est la règle la plus importante de cette section, parce qu'un formateur qui confondrait une estimation avec une date confirmée par la Direction Régionale prendrait une vraie décision sur une mauvaise information.

## Contenu généré par IA — indicateur de confiance

Toute donnée produite par l'IA (fiche de préparation, questions de contrôle, corrigé, correction suggérée) doit être visuellement marquée **tant qu'elle n'a pas été relue et validée par le formateur** :

- Bandeau discret en haut du bloc concerné : icône étoile/éclair + texte "Généré par l'IA — à relire", fond `--signal`-équivalent (`--mint` avec bordure `--forest` fine)
- Ce bandeau **disparaît** dès que le formateur modifie ou valide explicitement le contenu (bouton "Valider" ou simple édition du texte) — à ce moment, le contenu devient visuellement identique à un contenu saisi manuellement
- Cette règle découle directement des enseignements de l'audit précédent : ne jamais laisser une note ou un contenu généré passer pour définitif sans passage humain visible

## Données de référence denses (programme OFPPT) — divulgation progressive

Une fiche prescrite ou un tableau de suggestions pédagogiques contient beaucoup d'information réglementaire dense (codes, critères, pourcentages). Ne jamais l'afficher en un seul bloc compact :

- Affichage par défaut : **résumé court** (nom de la compétence, code, durée, objectif en une phrase)
- Un bouton "Voir le détail complet" déplie le contexte de réalisation, les critères de performance, les éléments de compétence — dans un panneau qui s'étend sous le résumé, pas dans une nouvelle page
- Objectif : le formateur consulte ce référentiel rarement mais a besoin d'y accéder vite quand il le fait — la divulgation progressive évite que cette donnée dense pollue l'écran au quotidien

## Composants de base

- **Bouton primaire** : fond `--forest`, texte blanc, coins 8px, pas d'ombre
- **Bouton secondaire** : fond `--surface`, bordure 1px `--border`, texte `--ink`
- **Badge de type** (ex. type de séance, type de module) : forme pilule, petit point coloré + texte, fond transparent, bordure fine — comme "Full time / Part time" dans le modèle de référence
- **Statut** : point plein 8px de la couleur du statut + texte, sur un fond pastel (10% d'opacité de la couleur) — jamais une couleur seule comme unique signal, toujours accompagnée du mot explicite
- **Avatar** : cercle avec initiales sur fond `--mint`, bordure fine `--border` en permanence, anneau `--forest` 2px au focus clavier
- **Icônes d'action** : chaque bouton d'action (Modifier, Supprimer, Ajouter, etc.) porte une icône (lucide-react, 16px) avant le texte, espacement 6px
- **Champ de formulaire** : bordure 1px `--border`, fond `--surface`, focus en bordure `--forest` 2px

## Règles UX

- **Une seule action primaire par écran.** Le bouton d'action principale (ex. "Créer un groupe") est toujours unique, à droite de la barre d'outils, jamais dupliqué ailleurs sur la même page.
- **Actions secondaires en menu discret.** Modifier/Supprimer/Dupliquer sur une ligne de tableau passent par un menu "..." (kebab) en fin de ligne, jamais par des boutons visibles en permanence qui chargent visuellement le tableau.
- **Le statut n'est jamais porté par la couleur seule.** Toujours coupler couleur + mot (accessibilité pour les daltoniens) — "Validé" en vert, jamais juste un point vert sans texte.
- **Confirmation obligatoire avant toute suppression.** Une modale ou un état inline explicite ("Supprimer définitivement ce stagiaire ?") avant toute action destructive, jamais de suppression en un clic.
- **Retour visible après chaque action.** Une notification discrète (toast) confirme "Stagiaire ajouté", "Modification enregistrée" — l'utilisateur ne doit jamais se demander si son clic a fonctionné.
- **États vides = invitation à agir, jamais un simple message.** Une liste vide affiche une icône, une phrase explicative, et le bouton d'action pour combler ce vide (ex. "Aucun stagiaire pour l'instant" + bouton "Ajouter un stagiaire"), pas juste "Aucune donnée".
- **Recherche et filtres toujours visibles, jamais cachés dans un menu**, sur toute liste de plus de 8 éléments.
- **La navigation latérale reste identique sur toutes les pages protégées** — aucune page ne doit avoir sa propre variante de menu.
- **Formulaires : validation en ligne, pas seulement à la soumission.** Un champ email mal formé signale l'erreur dès qu'on quitte le champ, pas seulement au clic sur "Enregistrer".
- **Cohérence du vocabulaire.** Le mot utilisé sur un bouton doit être le même que celui utilisé dans le message de confirmation qui suit ("Publier" produit "Publié", jamais "Envoyé").
- **Sous 768px, la barre latérale se transforme en menu hamburger**, jamais en barre latérale rétrécie illisible.
- **La couleur de marque s'utilise au-delà du seul bouton primaire.** Icônes de navigation en `--forest` même à l'état inactif (pas de gris neutre par défaut), léger fond `--mint` au survol des lignes de tableau, bordure gauche `--forest` 3px sur l'élément le plus important d'un groupe de cartes (ex. la statistique la plus critique du dashboard).
- **Focus clavier toujours visible** (contour `--forest` 2px minimum) sur tout élément interactif ; contraste texte/fond conforme AA sur tout le texte.
- **La préparation d'un contrôle suit un parcours guidé en étapes visibles** (contenu couvert → choix du format → assistance IA → relecture/validation), jamais un formulaire unique avec tout mélangé — chaque étape affiche où l'utilisateur en est (ex. indicateur "Étape 2 sur 4"), cohérent avec le fait que le formateur garde la main à chaque étape (PRD §4.7).
- **Un module porte toujours son code opérationnel court en évidence** (ex. `M106`) dans `IBM Plex Mono`, avec le nom complet de la compétence juste à côté en texte normal — jamais l'un sans l'autre, le formateur pense en codes courts au quotidien mais a besoin du nom complet pour lever toute ambiguïté.