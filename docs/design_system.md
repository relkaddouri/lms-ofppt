# Design System — LMS OFPPT (v3 — confirmée par Claude Design)

**Cette version remplace les palettes/typographies estimées des versions précédentes par les valeurs réelles extraites des 20 écrans produits dans `docs/new_design/`.** Toute divergence trouvée par la suite entre ce fichier et un écran livré doit être signalée, pas silencieusement arbitrée.

Identité "tableau de pilotage clair" inspirée d'un dashboard SaaS professionnel (type outil RH — vue liste, vue tableau/board, fil de commentaires avec mentions et réactions, panneau de notifications) : fond clair, cartes blanches, hiérarchie nette, statuts lisibles au premier coup d'œil. Ça correspond bien à ce que fait l'outil : le formateur pilote des groupes de stagiaires qui avancent par étapes, exactement comme un recruteur pilote des candidats à travers un pipeline.

**Deux publics, deux logiques d'écran.** L'espace formateur (desktop, dense, orienté tableau/données) et l'espace stagiaire (mobile, aéré, orienté fil/consultation rapide) partagent la même palette et la même typographie, mais pas la même densité d'information ni les mêmes patterns de navigation. Ne jamais transposer un pattern formateur (tableau dense, barre latérale) tel quel côté stagiaire.

**Ce fichier est un contrat de gouvernance, pas juste une feuille de style.** Toute personne (humaine ou agent IA) qui ajoute un composant à l'avenir doit d'abord vérifier s'il existe déjà un token ou un pattern ici avant d'en inventer un nouveau. La section 12 (Gouvernance) fixe la procédure.

## 1. Palette — identité OFPPT

**Confirmé par la Planche de style OFPPT produite dans Claude Design** (`docs/new_design/Planche de style OFPPT.dc.html`, réf. document DS-OFPPT-01), puis **affiné par analyse de fréquence sur les 21 écrans livrés** — deux niveaux de texte et deux fonds neutres manquaient à la première extraction, corrigés ci-dessous.

| Nom | Hex | Usage |
|---|---|---|
| `--ofppt-ink` | #2E3B4E | Bleu-ardoise — titres, navigation, boutons primaires. **Pas le texte courant** (voir `--body` ci-dessous) |
| `--ofppt-ink-dark` | #25303F | Variante foncée (hover/pressed sur boutons primaires) |
| `--ofppt-coral` | #E2574C | Corail — accent de marque, emphase rare, alertes, retards |
| `--ofppt-coral-dark` | #B8433A | Variante foncée du corail (hover/pressed) |
| `--ofppt-green` | #3C8C5C | Vert — statuts positifs |
| `--ofppt-green-dark` | #2C6C46 | Variante foncée du vert |
| `--ofppt-teal` | #2E7D9E | Sarcelle — statuts informatifs, liens, focus de champ (halo 3px) |
| `--ofppt-teal-dark` | #245F79 | Variante foncée de la sarcelle |
| `--paper` | #F6F7F9 | Fond de page |
| `--paper-alt` | #FAFBFC | Variante de fond (légèrement plus claire) |
| `--surface` | #FFFFFF | Cartes, tableaux, barre latérale |
| `--border` | #E3E7EC | Bordures fines |
| `--border-strong` | #C9D2DC | Bordures plus marquées (séparateurs de section, contour bouton secondaire) |
| `--mint` | #EDF0F3 | Fond des états actifs/survol (nav active) |
| `--wash` | #EFF2F5 | Survol de ligne de tableau, zébrures — distinct de `--mint`, plus neutre |
| `--wash-strong` | #F2F4F7 | États désactivés, fond de badge "Brouillon" |
| `--separator` | #EDF0F3 | Filet interne de carte (même valeur que `--mint`, rôle distinct : séparation, pas état actif) |

### Échelle de texte — six niveaux, confirmée par fréquence réelle sur 21 écrans

**Correction du fichier précédent** : le texte courant du corps n'utilise **pas** `--ofppt-ink` mais un ton plus doux. `body { color: var(--body) }` par défaut.

| Nom | Hex | Fréquence mesurée | Usage |
|---|---|---|---|
| `--ofppt-ink` | #2E3B4E | — | Titres uniquement |
| `--body` | #3F4E62 | 143 occurrences | **Texte courant** — le défaut de tout corps de texte |
| `--slate-2` | #5B6A7D | 110 occurrences | Texte secondaire (descriptions, sous-titres de carte) |
| `--slate` | #6B7A8D | — | Métadonnées (dates, auteurs) |
| `--slate-light` | #8C99A8 | — | Labels de champ, placeholders |
| `--muted` | #A9B4C0 | — | Texte désactivé |

### Fonds de statut (teintes, distincts des fonds neutres)

| Nom | Hex | Usage |
|---|---|---|
| `--bg-success` | #EAF3EE | Fond succès (derrière un badge ou un bandeau positif) |
| `--bg-alert` | #FCEDEB | Fond alerte (derrière un badge ou un bandeau de risque) |
| `--tint-teal` | #E8F2F7 | Fond informatif léger |
| `--tint-green` | #CFE4D8 | Fond succès plus soutenu |

### Couleurs de statut (texte)

| Nom | Hex | Usage |
|---|---|---|
| `--status-success` | #3C8C5C | Validé, Fait, Accepté |
| `--status-danger` | #E2574C | Rejeté, Échec, Retard |
| `--status-neutral` | #6B7A8D | Expiré, Archivé, Brouillon |
| `--status-info` | #2E7D9E | En cours, En attente |

### Règle d'usage du corail — citée de la planche de style, affinée par l'usage réel sur 21 écrans

> *"Le corail ne porte jamais une surface : il souligne un seul point d'attention par écran — un retard, un dépassement, une action irréversible."*

**Précision apportée après vérification sur les écrans livrés (23 boutons corail pleins recensés : `confirmSubmit`, `applySuggestion`, `validateAi`)** : "ne porte jamais une surface" vise les fonds décoratifs (panneaux, cartes, zones de mise en avant), pas les boutons d'action. **Un bouton `destructive` en corail plein est autorisé** — c'est précisément lui, l'unique action engageante d'un écran, qui incarne "le seul point d'attention". La règle reste stricte sur le nombre : un écran ne doit jamais afficher **plus d'un** élément corail en même temps (qu'il s'agisse d'un bouton plein, d'une bordure `danger`, d'un badge d'alerte ou d'un avatar) — si un bouton `destructive` est présent, rien d'autre sur cet écran ne doit être corail.

**Implication pour toute liste de personnes (avatars)** : le corail est exclu de la palette de couleurs d'avatar, précisément parce qu'une liste de plusieurs personnes ferait mécaniquement apparaître plusieurs avatars corail, ce qui violerait la règle du "un seul à la fois". Palette d'avatar : `--ofppt-ink`, `--ofppt-green`, `--ofppt-teal` uniquement, couleur stable et non permutée par personne.

## 2. Typographie

**Confirmé par la planche de style** : les polices réelles sont différentes de ce qui avait été estimé initialement — `Sora` remplace `General Sans`, `Source Sans 3` remplace `Inter`. `IBM Plex Mono` reste inchangée.

**Chargement obligatoire** : `Sora`, `Source Sans 3` et `IBM Plex Mono` doivent être importées via `next/font` dans `app/layout.tsx` et appliquées globalement (variable CSS + classes), jamais laissées retomber sur la police système par défaut — vérifier ce point avant toute autre retouche visuelle.

- **Titres / display** : `Sora` (600-700) — titres de page et d'en-tête de section
- **Corps / interface** : `Source Sans 3` (400, 600 pour l'emphase) — tout le texte courant, tableaux, formulaires, navigation
- **Données tabulaires** : `IBM Plex Mono` (500), utilisé largement — pas seulement les colonnes numériques mais toute donnée précise : codes de module, taux, dates courtes, effectifs, identifiants

Échelle : 12px (légendes, labels de section en majuscules espacées) / 14px (corps, cellules de tableau) / 16px (corps large) / 24px (titres de page) / 28px (titre principal du dashboard).

## 3. Layout

- **Largeur de contenu** : 1200px maximum, centré, padding latéral 32px. Les formulaires (champs de saisie, textarea) sont limités à 640px de large — jamais de contenu étiré sur toute la largeur de la fenêtre.
- **Barre latérale** : 240-260px, fond `--surface`, sections groupées avec labels en majuscules 11px `--slate` espacées (ex. "GESTION", "SUIVI", "AUTRES"), items icône + libellé, item actif sur fond `--mint` avec texte et icône `--ofppt-ink`
- **Barre supérieure** : titre de page en gras à gauche, cluster d'icônes utilitaires à droite (recherche, notifications avec badge rouge de compteur, avatar de l'utilisateur connecté)
- **Barre d'outils de liste** : champ de recherche avec icône, bouton filtre, bouton tri, bouton principal d'action aligné à droite (fond `--ofppt-ink`, texte blanc, coins arrondis 8px)
- **Onglets de filtre** : ligne d'onglets texte au-dessus des tableaux (ex. Tous / En cours / Terminé / Archivé), onglet actif en texte `--ofppt-ink` gras, les autres en `--slate`
- Cartes et tableaux : bordure fine 1px `--border` + ombre légère (`0 1px 2px rgba(46,59,78,.05)` — teintée avec `--ofppt-ink`, pas du noir pur, confirmé sur les 20 écrans livrés) pour se détacher clairement du fond `--paper`, coins arrondis 10-12px

### Élévation (ombres) — valeurs confirmées, teintées `--ofppt-ink` plutôt que noir pur

| Niveau | Valeur | Usage |
|---|---|---|
| Repos | `0 1px 2px rgba(46,59,78,.05)` | Carte au repos (le plus courant, valeur par défaut) |
| Flottant | `0 10px 28px rgba(46,59,78,.14)` | Menu déroulant ouvert, popover |
| Panneau latéral | `-18px 0 44px rgba(46,59,78,.18)` | Panneau qui glisse depuis la droite (notifications, filtres) |
| Barre/feuille ancrée | `0 -4px 16px rgba(46,59,78,.06)` | Barre de navigation mobile fixe en bas, feuille modale mobile |

### Rayon de bordure — échelle confirmée

`999px` pour toute forme pilule (badge, avatar). `7-9px` pour les éléments interactifs de petite taille (boutons, champs, puces). `10-14px` pour les cartes et conteneurs. Ne pas descendre sous 7px ni dépasser 14px hors pilule.

## 4. Élément signature : la ligne d'identité à deux niveaux

Repris directement du modèle de référence : chaque ligne représentant une personne (stagiaire, formateur) affiche un avatar (ou initiales sur fond `--mint` si pas de photo), le nom en `--ofppt-ink` gras sur la première ligne, et l'information secondaire (email, ou groupe) en `--slate` plus petit juste en dessous. Ce motif s'applique à toute liste de personnes dans l'app : liste de stagiaires, liste de formateurs si multi-comptes.

La colonne de progression réutilise le même principe qu'une colonne "Score" : un pourcentage simple, aligné à droite, en `IBM Plex Mono`, jamais une barre graphique complexe — la clarté du chiffre prime.

## 5. Nouveaux patterns inspirés des captures de référence

Trois patterns visibles dans les nouvelles captures fournies n'existent pas encore dans l'app et doivent être ajoutés au vocabulaire du design system avant d'être implémentés où c'est utile.

### 5.1 Bascule vue liste / vue tableau (board)

Sur une page de liste dense (ex. Progression avec ses 62 séances), propose une bascule à deux icônes en haut à droite de la barre d'outils, à côté du tri et du filtre : une icône liste (lignes empilées), une icône tableau (colonnes). L'état actif a un fond `--mint` et une bordure `--ofppt-ink`. La vue tableau groupe les éléments en colonnes par statut (ex. À faire / Fait / Sans date), chaque colonne avec un en-tête portant un point de couleur de statut + le nombre d'éléments, chaque carte reprenant le motif de ligne d'identité à deux niveaux (§4) en version compacte. Usage recommandé : Progression (par statut de séance), Contrôles à corriger (par statut de correction) — pas partout, seulement où grouper par statut aide réellement à visualiser une charge de travail.

### 5.2 Panneau de notifications

Une icône cloche dans la barre supérieure, avec un badge rond `--ofppt-coral` affichant le nombre de notifications non lues. Au clic, un panneau latéral (pas une modale centrée) s'ouvre depuis la droite, largeur ~420px, avec : un en-tête "Notifications" + compteur + "Tout marquer comme lu", puis les notifications groupées par période relative (Aujourd'hui / Hier / Plus ancien), chacune avec avatar ou icône, texte court, horodatage relatif ("2 min"), et un point `--ofppt-coral` non lu qui disparaît à la lecture. Usage pour ce projet : rappels de contrôle (§4.6 du PRD), questions de stagiaires en attente de réponse, échéances réglementaires proches.

### 5.3 Fil de commentaires avec réactions et étiquettes de visibilité

Au-delà du fil d'annonces déjà présent côté stagiaire, ce pattern s'applique à tout contexte de discussion contextuelle (ex. commentaires internes sur une copie, échange formateur-formateur sur un groupe partagé). Chaque entrée : avatar, nom, une étiquette pilule optionnelle indiquant la visibilité ("Privé" en `--ofppt-coral` clair, "Équipe" en `--ofppt-teal` clair) et le rôle de l'auteur en texte `--slate`, le message, puis une rangée d'actions discrètes (réagir, marquer comme lu, menu "..."). Une réaction existante s'affiche en pastille arrondie avec l'emoji/icône et un compteur. La mention `@nom` dans un message est cliquable et surlignée en fond `--mint`, texte `--ofppt-ink`. Champ de saisie en bas avec les actions (lien, mention, bascule de visibilité) sur une ligne dédiée sous le texte, jamais mélangées au texte.

## 6. Espace stagiaire — mobile-first (règles spécifiques)

Le stagiaire consulte l'app quasi exclusivement depuis son téléphone (§Espace stagiaire du PRD). Ces écrans suivent des règles différentes de l'espace formateur, pensé lui pour un écran de bureau :

- **Navigation par barre inférieure fixe** (bottom tab bar), pas de barre latérale — 4 onglets maximum : Fil, Devoirs, Contrôles, Emploi du temps. Icône + libellé court, item actif en `--ofppt-ink` avec un point `--mint` derrière l'icône.
- **Cibles tactiles de 44×44px minimum** sur tout élément interactif (bouton "j'aime", icône de commentaire, item de liste) — jamais de cible plus petite, même pour une icône discrète.
- **Fil d'actualité en cartes empilées**, une annonce = une carte pleine largeur avec padding généreux (16px), séparateur `--border` fin entre cartes plutôt que des cartes flottantes avec ombre (évite l'effet "liste de courses" sur mobile).
- **Réaction "j'aime" et commentaire toujours visibles en bas de carte**, jamais cachés derrière un menu — ce sont les actions principales du fil, elles doivent être atteignables en un tap.
- **Le tag/mention d'un camarade** utilise le symbole `@` suivi d'une liste déroulante filtrée au fur et à mesure de la frappe, le nom taggé apparaît ensuite en `--ofppt-ink` cliquable dans le texte (pas juste souligné).
- **Priorité au contenu, pas à la densité.** Contrairement à l'espace formateur (dense, orienté tableau), l'espace stagiaire privilégie des blocs aérés, une seule information principale par carte — le stagiaire scanne rapidement entre deux cours, il ne travaille pas dans l'app.

## 7. Calendrier et créneaux — langage visuel

Le calendrier (formateur) doit distinguer visuellement plusieurs états qui ont un sens réglementaire différent (PRD §4.9-4.10) — une différence de couleur ou de style de bordure suffit, mais elle doit être systématique :

- **Bloc matin/soir** : représenté comme un rectangle unique de la durée du bloc (8h30-13h30 ou 13h30-18h30), avec une fine ligne pointillée `--border` à l'endroit de la pause interne (10h45 ou 15h45) — visuellement "un bloc qui respire", pas une vraie coupure.
- **Date de contrôle estimée par l'app** (CC1, CC2, EFM local) : bordure **en pointillés** `--blueprint`-équivalent (`--ofppt-ink` à 60% d'opacité), fond `--mint` très clair — signale "prévision, pas encore fixée".
- **Date de contrôle confirmée manuellement** (EFM régional saisi) : bordure **pleine** `--ofppt-ink`, fond `--surface` — signale "date ferme".
- Ne jamais utiliser la même représentation pour ces deux états : c'est la règle la plus importante de cette section, parce qu'un formateur qui confondrait une estimation avec une date confirmée par la Direction Régionale prendrait une vraie décision sur une mauvaise information.

## 8. Contenu généré par IA — indicateur de confiance

Toute donnée produite par l'IA (fiche de préparation, questions de contrôle, corrigé, correction suggérée) doit être visuellement marquée **tant qu'elle n'a pas été relue et validée par le formateur** :

- Bandeau discret en haut du bloc concerné : icône étoile/éclair + texte "Généré par l'IA — à relire", fond `--signal`-équivalent (`--mint` avec bordure `--ofppt-ink` fine)
- Ce bandeau **disparaît** dès que le formateur modifie ou valide explicitement le contenu (bouton "Valider" ou simple édition du texte) — à ce moment, le contenu devient visuellement identique à un contenu saisi manuellement
- Cette règle découle directement des enseignements de l'audit précédent : ne jamais laisser une note ou un contenu généré passer pour définitif sans passage humain visible

## 9. Données de référence denses (programme OFPPT) — divulgation progressive

Une fiche prescrite ou un tableau de suggestions pédagogiques contient beaucoup d'information réglementaire dense (codes, critères, pourcentages). Ne jamais l'afficher en un seul bloc compact :

- Affichage par défaut : **résumé court** (nom de la compétence, code, durée, objectif en une phrase)
- Un bouton "Voir le détail complet" déplie le contexte de réalisation, les critères de performance, les éléments de compétence — dans un panneau qui s'étend sous le résumé, pas dans une nouvelle page
- Objectif : le formateur consulte ce référentiel rarement mais a besoin d'y accéder vite quand il le fait — la divulgation progressive évite que cette donnée dense pollue l'écran au quotidien

## 10. Composants de base

**Spécifications confirmées par les 21 écrans livrés** — remplacent les descriptions génériques précédentes.

- **Bouton** : rayon 9px, padding 11×20px, 5 variantes —
  - *Primaire* : fond `--ofppt-ink`, texte blanc
  - *Secondaire* : fond `--surface`, bordure 1px `--border-strong` (#C9D2DC), texte `--body`
  - *Ghost* : pas de bordure (réservé aux actions d'icône) — pas de bordure, contrairement aux autres variantes
  - *Danger* (signal, pas engagement définitif — ex. "Signaler un retard") : contour corail, bordure `#F0BDB8`, texte `--ofppt-coral`
  - *Destructive* (l'action la plus engageante de l'écran — ex. confirmer une suppression, valider une proposition IA) : fond `--ofppt-coral` plein, texte blanc — devient alors l'unique élément corail autorisé sur cet écran (voir règle du corail en §1)
  - *Désactivé* : fond `--wash-strong` (#F2F4F7), texte `--muted` (#A9B4C0)
- **Badge de statut** : forme pilule (999px), point 6px + texte, fond ET bordure teintés par la couleur du statut — jamais une couleur seule comme unique signal
- **Badge de type** (ex. type de séance, type de module) : même forme pilule, point coloré + texte, fond `--surface` avec bordure fine — distinct du badge de statut par l'absence de fond teinté
- **Avatar** : 44px, fond plein coloré (palette : `--ofppt-ink`, `--ofppt-green`, `--ofppt-teal` — **jamais corail**, voir §1) avec initiales blanches en `Sora` 600, pas de bordure, anneau `--ofppt-ink` 2px au focus clavier
- **Icônes d'action** : chaque bouton d'action (Modifier, Supprimer, Ajouter, etc.) porte une icône (lucide-react, 16px) avant le texte, espacement 6px
- **Champ de formulaire** : rayon 9px, **bordure 1px `--border-strong`** (pas `--border`, qui est trop pâle et disparaît sur fond blanc — réservée aux cartes et séparateurs), label 14px/600 au-dessus du champ, focus en halo sarcelle 3px (`--ofppt-teal` à faible opacité)
- **Carte** : padding 24px (pas 16px), filet interne éventuel en `--separator`

## 11. Règles UX

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
- **La couleur de marque s'utilise au-delà du seul bouton primaire.** Icônes de navigation en `--ofppt-ink` même à l'état inactif (pas de gris neutre par défaut), léger fond `--mint` au survol des lignes de tableau, bordure gauche `--ofppt-ink` 3px sur l'élément le plus important d'un groupe de cartes (ex. la statistique la plus critique du dashboard).
- **Focus clavier toujours visible** (contour `--ofppt-ink` 2px minimum) sur tout élément interactif ; contraste texte/fond conforme AA sur tout le texte.
- **La préparation d'un contrôle suit un parcours guidé en étapes visibles** (contenu couvert → choix du format → assistance IA → relecture/validation), jamais un formulaire unique avec tout mélangé — chaque étape affiche où l'utilisateur en est (ex. indicateur "Étape 2 sur 4"), cohérent avec le fait que le formateur garde la main à chaque étape (PRD §4.7).
- **Un module porte toujours son code opérationnel court en évidence** (ex. `M106`) dans `IBM Plex Mono`, avec le nom complet de la compétence juste à côté en texte normal — jamais l'un sans l'autre, le formateur pense en codes courts au quotidien mais a besoin du nom complet pour lever toute ambiguïté.

## 12. Gouvernance des futurs composants

Cette section existe pour une seule raison : garantir que dans un an, avec vingt composants de plus, l'app ait toujours l'air d'avoir été dessinée par une seule main.

### Avant d'ajouter un composant

1. **Cherche d'abord un pattern existant** dans les sections 4, 5, 9, 10 de ce fichier qui couvre déjà le besoin, même partiellement. Adapter un pattern existant est toujours préférable à en créer un nouveau.
2. **Si aucun pattern n'existe**, vérifie que tous les styles utilisés viennent des tokens définis en section 1-3 (couleur, typographie, espacement). Un nouveau composant qui invente une couleur ou une taille de police est un échec de cette règle, pas une exception.
3. **Documente le nouveau pattern ici avant ou en même temps que son implémentation** — un composant qui existe dans le code mais pas dans ce fichier n'est pas gouverné, et sera probablement réinventé différemment ailleurs six mois plus tard (c'est exactement ce qui s'est produit avec le kebab menu, retrouvé en SVG fait main dans un composant alors qu'il existait déjà ailleurs).

### Échelle d'espacement (à respecter pour tout nouveau composant)

Grille de 8px : 4 (micro-ajustement uniquement), 8, 12, 16, 24, 32, 48, 64px. Ne jamais utiliser une valeur hors de cette échelle.

### Élévation (ombres)

Voir l'échelle à 4 niveaux confirmée en section 3 — ne jamais inventer un cinquième niveau, et toujours teinter l'ombre avec `rgba(46,59,78,...)` plutôt que du noir pur (`rgba(0,0,0,...)`), c'est la signature visuelle confirmée de cette identité.

### Mouvement

Transitions courtes uniquement (150-200ms, `ease-out`) sur les changements d'état (survol, ouverture de panneau, apparition de toast). Aucune animation décorative sans fonction (pas de rebond, pas de fade-in sur du contenu qui n'a pas besoin d'attirer l'attention). `prefers-reduced-motion` toujours respecté.

### Nommage

Un composant partagé porte un nom français métier s'il est spécifique au domaine (`RailDeProgression`, `BandeauIa`), un nom anglais générique s'il est purement technique/réutilisable (`Button`, `Modal`, `KebabMenu`) — cohérent avec la convention déjà établie dans `conventions.md` (français pour le métier, anglais pour la technique).

### Revue périodique

Comme pour `conventions.md`, relis ce fichier face au code réel tous les 8-10 composants ajoutés — pas seulement au moment de l'écrire. Un design system qui n'est jamais confronté au code dérive silencieusement, exactement comme on l'a vu avec le token `--mist` jamais défini mais utilisé 18 fois.