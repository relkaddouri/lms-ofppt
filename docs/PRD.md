# PRD — LMS OFPPT (Classeur pédagogique numérique) — v3

**Version 3** — changement structurant sur le fonctionnement de la planification, communiqué par le porteur de projet en cours de développement (l'app s'appelle désormais "Pédago" dans son interface, ce document garde le nom de code historique du projet). Trois changements majeurs par rapport à la v2 :

1. Le **motif hebdomadaire récurrent** devient le mécanisme pivot qui génère les séances automatiquement (§4.9), remplaçant la création séance par séance à la main supposée en v2.
2. Une **page "Emploi du temps" dédiée**, document officiel exportable en PDF (§4.9), distincte du calendrier opérationnel au quotidien (§4.10).
3. **Correction de la convention de nommage des modules** : deux séries distinctes par année (`M1XX` pour le tronc commun, `M2XX` pour la spécialisation), pas un pattern unique basé sur le numéro de compétence (§3).

---

## 1. Contexte et problème à résoudre

Le porteur du projet est formateur OFPPT, spécialité Digital Design (Pôle Digital & IA). Le métier de formateur OFPPT s'appuie sur une hiérarchie documentaire officielle lourde (programme de formation → compétences → fiches prescrites → suggestions pédagogiques) qui doit être retraduite, chaque année et pour chaque séance, en une fiche de préparation opérationnelle. Ce travail de retraduction n'est en pratique réalisé correctement par presque aucun formateur — le porteur du projet inclus — ce qui produit des séances mal préparées.

**Le problème central n'est pas l'absence d'outil de gestion de classe.** C'est l'absence d'un pont fiable entre le référentiel officiel (souvent complexe, versionné par spécialité) et la préparation concrète du jour, séance par séance.

**Objectif du produit** : que le formateur puisse, chaque jour, entrer dans un groupe, choisir le module, voir où il en est dans la progression, et trouver — déjà prête ou générée à la volée avec l'aide de l'IA — la fiche de préparation et le support de cours de la séance du jour, sans improviser.

Objectifs secondaires, également exprimés par le porteur du projet :

- Suivre la progression par groupe et par module, avec déclenchement automatique du besoin de contrôle
- Générer des contrôles avec l'aide de l'IA, les administrer et les corriger
- Gérer présences, calendrier (jours fériés OFPPT, emploi du temps personnel, absences)
- Produire un export "classeur pédagogique" dans un format proche du format papier attendu lors des audits internes OFPPT

---

## 2. Utilisateurs

| Rôle | Description | Besoins principaux |
|---|---|---|
| **Formateur** | Utilisateur principal — porteur du projet et, à terme, potentiellement d'autres formateurs du même centre | Préparer ses séances, suivre la progression, générer et corriger des contrôles, gérer son calendrier |
| **Stagiaire** | Compte authentifié (login + mot de passe), accès principalement depuis mobile | Voir un fil d'actualité (annonces du formateur, avec commentaires et réactions "j'aime"), consulter ses devoirs et ses contrôles par module, consulter son emploi du temps, consulter les supports de cours et poser des questions dessus (avec possibilité de mentionner/taguer un camarade) |

*L'audit des fiches de préparation par l'administration OFPPT ne nécessite pas d'accès à l'application : il se fait via l'export "classeur pédagogique" (§4.13), remis en PDF ou imprimé. Aucun rôle applicatif dédié n'est donc prévu pour l'administrateur.*

---

## 3. Hiérarchie documentaire OFPPT — modèle conceptuel

C'est la fondation du produit. Toute la structure de données doit refléter fidèlement cette hiérarchie réelle, pas une structure LMS générique.

```
Spécialité (ex. Digital Design — Option UX Designer)
 └── Programme de formation (par spécialité)
      ├── Durée totale du programme (ex. 1435h pour UX Designer : 895h compétences spécifiques + 540h transversales)
      └── Compétence — appelée "Module" dans la terminologie officielle OFPPT (16 au total pour UX Designer)
           ├── Code officiel (ex. DIA_DESOUX_TS-06), numéro (1 à 16), durée nationale de référence (15h à 160h selon la compétence)
           ├── Code opérationnel court utilisé au quotidien (ex. M106) — voir correspondance ci-dessous
           ├── Fiche prescrite
           │    ├── Durée totale, répartition théorique/pratique/évaluation (%)
           │    ├── Contexte de réalisation
           │    ├── Critères généraux de performance
           │    ├── Éléments de la compétence (A, B, C…)
           │    └── Critères particuliers de performance (par élément)
           └── Suggestions pédagogiques
                └── Pour chaque élément de la compétence :
                     ├── Apprentissages de base
                     ├── Éléments de contenu
                     ├── Activités d'apprentissage
                     └── Durée suggérée (%)

Groupe (ex. DES101, DES102, DDOUX201, DDOUI201)
 ├── Année (1ère année tronc commun / 2ème année spécialisation)
 ├── Spécialité (si 2ème année)
 └── Modules suivis, chacun avec sa propre masse horaire allouée à CE groupe
      (la durée nationale de référence de la compétence est un cadre, la masse horaire
      réellement allouée par groupe peut différer — voir exemple chiffré en §4.1)

Assignation Formateur ↔ Groupe ↔ Module
 (un formateur peut être assigné à un sous-ensemble variable de modules par groupe — voir §4.1)

Séance (rattachée à un couple Groupe + Module précis)
 ├── Date, heure de début, heure de fin (durée exacte — pas une durée de module générique)
 ├── Mode (présentiel / à distance)
 ├── Objectif opérationnel de la séance (prévision, saisi en amont)
 ├── Fiche de préparation (générée ou rédigée, pour la durée exacte de la séance)
 ├── Support de cours (généré ou importé)
 ├── Présences des stagiaires (liste des absents)
 ├── Contenu réalisé (vs contenu prévu), durée réalisée, durée cumulée sur le module
 └── Contenu "à prévoir pour la prochaine séance" (champ de transition entre deux séances)

 Note : plusieurs séances peuvent se succéder le même jour sur des modules différents
 (ex. 3h sur le module A puis 2h sur le module B dans un même bloc de 5h) — voir §4.11.
```

**Correspondance code officiel ↔ code opérationnel — corrigée par le porteur de projet (v3).** Le programme complet de la spécialité UX Designer compte **16 compétences** (le document officiel les appelle lui-même "modules"), codées `DIA_DES_TS-01` à `DIA_DESOUX_TS-16`. Au quotidien, le classeur pédagogique utilise des codes courts qui suivent **deux séries distinctes selon l'année**, pas un pattern unique :

- **1ère année (tronc commun, compétences 1 à 8)** : préfixe `M1`, numéro identique à celui de la compétence — `M101` à `M108`. Ex. `M106` = compétence n°6.
- **2ème année (spécialisation, compétences 9 à 16)** : préfixe `M2`, numéro **décalé de -8 par rapport à la compétence** — `M201` à `M208`. Ex. `M201` = compétence n°9, `M206` = compétence n°14.

La **compétence n°16** (`M208`, "S'intégrer en milieu professionnel", 160h) est le module de stage/soutenance (§4.14), traité à part fonctionnellement même s'il porte un code `M2XX` par cohérence de nommage. Un module `EGTSI106` apparaît aussi dans les exemples réels — hors des 16 compétences de spécialité, probablement un module transversal commun à plusieurs filières (culture numérique générale) ; le modèle de données doit rester assez souple pour accueillir des modules qui ne suivent ni le pattern `M1XX` ni `M2XX`.

**Implication produit** : le code opérationnel affiché à l'écran doit toujours être dérivé de l'année du cycle (`tronc_commun` → `M1XX`, `specialisation` → `M2XX`) et du rang de la compétence dans son cycle, jamais recalculé à partir du seul numéro de compétence 1-16 comme le modèle initial le supposait à tort.

**Distinction importante à ne jamais confondre dans le produit** :

- Les documents **officiels** (fiche prescrite, suggestions pédagogiques, guide de soutien pédagogique) sont des **référentiels stables**, saisis/importés une fois par module et réutilisés chaque année.
- La **fiche de préparation** est un document **opérationnel par séance**, généré à partir du référentiel + du contexte réel de la séance (date, durée, ce qui a déjà été vu) — c'est elle qui doit être produite rapidement et régulièrement, contrairement au référentiel qui change rarement.

---

## 4. Fonctionnalités

### 4.1 Gestion des Groupes, Modules et Assignations

Le nombre de modules qu'un formateur enseigne n'est pas fixe et varie par groupe. Le modèle doit supporter une table d'assignation flexible *Formateur ↔ Groupe ↔ Module*, illustrée par le cas réel du porteur de projet :

| Groupe | Modules assignés à ce formateur |
|---|---|
| DES101 (1ère année) | M104, M106 (sur les compétences du tronc commun) |
| DES102 (1ère année) | M104, M106 |
| DDOUX201 (2ème année, spécialité UX Designer) | Les compétences de la spécialisation |

**Point confirmé par le classeur pédagogique réel fourni : la masse horaire d'un module n'est pas fixe, elle est définie par couple groupe+module, pas seulement par module.** Exemple tiré du document :

| Module | DES101 | DES102 |
|---|---|---|
| EGTSI106 (culture numérique) | 40h | 25h |
| M102 (Enjeux digitaux chez l'utilisateur) | 55h | 45h |
| M104 (Contexte d'un projet UX/UI Design) | 80h | 65h |
| M106 (Déterminer les concepts de l'UX/UI Design) | 110h | 85h |
| M108 (Interactions digitales) | 95h | 80h |

Le même module a donc une masse horaire différente selon le groupe — probablement pour tenir compte du niveau ou du rythme propre à chaque groupe. **La table d'assignation Groupe↔Module doit porter sa propre masse horaire allouée, distincte de la durée nationale de référence de la compétence** (qui, elle, est fixe et vient du programme officiel — voir §3).

**Type d'EFM porté par le module, pas seulement par le contrôle — ajout v3.** Chaque module (au niveau de son assignation à un groupe, comme la masse horaire) porte un attribut `type_efm` : **local (EFML)** ou **régional (EFMR)**. Cette information ne sert pas seulement à distinguer un contrôle une fois créé (§4.7) — elle a un rôle de **planification en amont** :

- Un module à EFMR a une date d'épreuve **fixée par la Direction Régionale**, externe et non négociable. Le formateur a donc intérêt à **démarrer ces modules en priorité** dans l'année, pour ne pas se retrouver contraint par une échéance externe alors que le module n'est pas assez avancé.
- Le produit doit permettre de **visualiser facilement quels modules d'un groupe sont à EFMR**, pour orienter l'ordre de programmation des modules dans l'année (voir §4.9, motif hebdomadaire et génération de séances).

**Règles** :

- Un module peut être suivi par plusieurs groupes simultanément (ex. M104 par DES101 et DES102) — chaque couple groupe+module a sa propre progression, ses propres séances, et sa propre masse horaire allouée, indépendantes les unes des autres.
- Un groupe peut avoir plusieurs formateurs (chacun responsable d'un sous-ensemble de modules).
- La spécialisation de 2ème année comporte les compétences restantes du programme (après celles couvertes en tronc commun), dont la dernière (compétence 16, "S'intégrer en milieu professionnel") est toujours traitée à part (voir §4.14).

**À noter, distinction importante pour ne pas confondre deux notions de masse horaire** : la masse horaire vue ici (par groupe/module, ex. 420h/an pour un groupe sur l'ensemble de ses modules) est **différente** de la masse horaire légale annuelle du formateur (910h, §4.11) — la première mesure ce qu'un groupe reçoit au total (potentiellement réparti entre plusieurs formateurs), la seconde mesure la charge de travail totale d'un formateur (tous groupes et modules confondus).

### 4.1bis Formation à distance (FAD) et séances partagées entre groupes — ajout v3

**La masse horaire allouée à un couple groupe+module se décompose en présentiel et FAD.** À l'assignation d'un module à un groupe, en plus de la masse horaire totale (§4.1), le formateur précise combien d'heures relèvent de la formation à distance — le présentiel se déduit par soustraction (ex. 100h au total, 25h déclarées FAD → 75h présentiel calculées automatiquement, pas ressaisies).

**Particularité du tronc commun (1ère année) : une séance FAD peut être partagée entre deux groupes.** Contrairement au présentiel — toujours propre à un seul groupe — une séance FAD peut réunir DES101 et DES102 en une seule séance, parce que le contenu à distance est le même pour les deux. Ça change directement le calcul de charge réelle : sur l'exemple donné par le porteur de projet, un module de 100h (75h présentiel + 25h FAD) suivi par DES101 **et** DES102 ne représente **pas** 200h de dispense réelle (100h × 2 groupes) mais **175h** (75h + 75h de présentiel, chacun propre à son groupe, **plus 25h de FAD dispensées une seule fois** pour les deux groupes ensemble) — alors que chaque groupe continue d'être crédité individuellement de ses 100h dans sa propre progression.

**Implication sur le modèle de données — changement structurant** : une séance n'est plus systématiquement rattachée à un seul groupe. Le modèle doit permettre à une séance FAD d'être liée à **plusieurs groupes simultanément** (typiquement DES101+DES102 pour un module de tronc commun), alors qu'une séance présentielle reste toujours propre à un seul groupe. Quand une séance FAD partagée est marquée "faite", elle doit incrémenter la progression **des deux groupes en même temps**, sans compter cette heure en double dans le calcul de charge réelle du formateur.

**Champs et fonctionnalités à ajouter** :

- Sur la séance : un indicateur simple (case à cocher ou bouton bascule) "Cette séance est en FAD" — pas de formulaire complexe, une bascule suffit
- Quand une séance est marquée FAD : un champ **lien Teams** apparaît, à saisir pour cette séance précise
- **Deux compteurs de progression distincts par couple groupe+module** : heures présentiel réalisées / heures présentiel prévues, et heures FAD réalisées / heures FAD prévues — pas seulement un total confondu comme c'était implicitement le cas jusqu'ici

### 4.2 Import/saisie du référentiel officiel (Programme, Compétences, Fiches prescrites, Suggestions pédagogiques)

- Saisie ou import d'un programme de formation par spécialité — le document réel fourni (programme UX Designer, format Word) confirme une structure homogène et exploitable : 16 compétences numérotées, chacune avec un bloc "informations générales" (code, durée, prérequis, compétences en parallèle) suivi d'un tableau "suggestions pédagogiques"
- Chaque compétence du programme porte : code, numéro, durée nationale de référence, répartition théorique/pratique/évaluation, contexte de réalisation, critères généraux de performance, liste des éléments de la compétence avec leurs critères particuliers de performance, compétences préalables et compétences pouvant être menées en parallèle
- Pour chaque élément de compétence : apprentissages de base, éléments de contenu, activités d'apprentissage suggérées, durée suggérée (%)
- Ce référentiel est saisi **une fois par spécialité** et réutilisé chaque année — pas resaisi à chaque rentrée
- Format d'import à trancher techniquement lors du backlog : parsing semi-automatique du document Word (structure tabulaire assez régulière d'une compétence à l'autre, donc automatisable avec relecture humaine de contrôle) plutôt qu'une saisie manuelle intégrale, vu le volume (16 compétences détaillées)

### 4.2bis Répartition des éléments de contenu par séance — couverture garantie du référentiel national (ajout v3)

**Enjeu, à comprendre avant le mécanisme.** Ce référentiel n'est pas une simple base d'inspiration locale : c'est le programme national, identique pour tous les formateurs marocains de la spécialité. En 2ème année, les stagiaires passent un **Examen de Fin de Formation (EFF)** national, dont le porteur de projet est **le concepteur et le validateur**. L'EFF se construit en référence directe à ce référentiel — ce qui signifie que **chaque élément de contenu du référentiel doit avoir été effectivement couvert en séance**, chez lui comme chez tout autre formateur du pays, sans quoi l'examen porterait sur du contenu jamais enseigné. Ce n'est donc pas une préférence pédagogique, c'est une garantie de couverture curriculaire à respecter strictement.

**Ce que la répartition horaire fait déjà bien, à conserver tel quel** : pour chaque apprentissage de base (ex. A.1, A.2, A.3, A.4 sous l'élément A), le système répartit déjà correctement les heures théoriques et pratiques en proportion des pourcentages du référentiel national (ex. élément A = 35% de la masse horaire du module), et génère les séances correspondantes. C'est confirmé correct par le porteur de projet sur l'écran de répartition horaire déjà construit.

**Ce qui manque et doit être ajouté** : au-delà de la durée, chaque apprentissage de base porte une **liste d'éléments de contenu précis** (ex. pour A.1 "Appréhender la gestion de projet UX/UI" : définition du concept de projet, usage d'un cahier des charges, spécificités du projet UX/UI, analyse de sa propre expérience utilisateur, étude de benchmarking, initiation au Design Thinking). Le système doit :

1. **Répartir ces éléments de contenu sur les séances générées pour cet apprentissage** — si A.1 est couvert sur 2 séances, chaque séance reçoit un sous-ensemble précis et non chevauchant de ces éléments de contenu, de sorte que l'ensemble des séances couvre 100% de la liste officielle, sans doublon ni oubli.
2. **Faire de cette répartition la base de la fiche de préparation de chaque séance** (§4.3) — la fiche générée pour une séance ne doit pas être une synthèse générique de l'apprentissage entier, mais doit porter précisément les éléments de contenu qui lui ont été assignés.
3. **Afficher une vue de couverture** — par apprentissage, par élément de compétence, par module : quels éléments de contenu du référentiel ont été assignés à une séance déjà réalisée, lesquels restent à couvrir. Cette vue doit permettre au formateur de vérifier, avant la fin d'un module, que l'intégralité du référentiel a bien été couverte — pas seulement que les heures ont été dispensées.

**Implication sur le modèle de données** : une table de liaison entre séance et élément(s) de contenu couvert(s) — pas un simple texte libre, mais une référence explicite aux lignes du référentiel officiel importé en §4.2, pour que la vue de couverture puisse être calculée automatiquement plutôt que déclarée à la main.

### 4.3 Génération IA de fiches de préparation par séance

- Le formateur sélectionne un groupe, un module, une date de séance
- La fiche générée s'appuie sur :
  - La fiche prescrite et les suggestions pédagogiques du module concerné (source de vérité pédagogique)
  - **Les éléments de contenu précisément assignés à cette séance (§4.2bis)** — pas l'apprentissage de base dans son ensemble, seulement le sous-ensemble qui revient à cette séance précise
  - Ce qui a déjà été couvert dans les séances précédentes de ce couple groupe+module (pour éviter les répétitions et respecter la progression)
  - Le mode de la séance (présentiel / à distance) — le déroulé pédagogique peut différer

- La fiche générée est éditable avant validation, avec un historique de versions (comme dans la v1 déjà testée)
- Une fiche existe en version théorique et pratique — le produit doit permettre de générer les deux séparément ou ensemble selon le besoin de la séance
- Chaque séance porte aussi, en complément de la fiche : l'**objectif opérationnel** de la séance (prévision), le **contenu réalisé** effectivement couvert, la **durée réalisée** et son **cumul** sur le module, et un champ "**à prévoir pour la prochaine séance**" — ces quatre champs reprennent fidèlement la structure du tableau "Planification et suivi de réalisation" du cahier du formateur officiel, et alimentent directement le calcul de progression (§4.6)

**Format de la fiche — tranché : format officiel synthétique.** La fiche générée doit suivre strictement la définition du cahier du formateur officiel : *"Elle ne doit en aucun cas comprendre des détails du cours. C'est un schéma de la leçon, composé de mots clés, d'idées clés, d'exemples, d'éléments importants à ne pas oublier."* Concrètement, la génération IA produit un **aide-mémoire structuré** — mots-clés, idées clés, exemples, points de vigilance, construit autour des éléments de contenu assignés (§4.2bis) — et non un déroulé minuté détaillé. Le modèle "Fiche préparation : cours théoriques" donné en exemple initial (blocs minutés de 5-15 minutes avec contenu et stratégie pédagogique détaillés pour chacun) **ne sert donc plus de gabarit de génération** — il reste utile comme référence de structure globale (durée de séance, date, objectif) mais pas pour le niveau de détail du contenu pédagogique lui-même.

Implication pour le prompt de génération IA (§7, à préciser lors du backlog) : contraindre explicitement le modèle à produire un schéma court plutôt qu'un texte développé, avec une limite de longueur/densité pour éviter qu'il "déborde" vers un cours complet malgré la consigne — et à ne jamais s'écarter des éléments de contenu assignés à la séance, ni en omettre, ni en inventer d'autres.

### 4.4 Génération IA de support de cours (16:9)

- Pour les modules où le formateur ne dispose pas de cours existant (typiquement les modules de 2ème année, selon le porteur de projet), génération d'un support de type diaporama (16:9), aligné sur le contenu de la fiche de préparation de la séance
- Le support est consultable par les stagiaires depuis leur espace (§4.5), avec possibilité de poser des questions dessus

### 4.5 Espace stagiaire

Le stagiaire dispose d'un **compte authentifié** (login + mot de passe) — pas d'un simple accès par lien public. Priorité forte donnée au **responsive mobile** : c'est le mode de consultation principal attendu.

Fonctionnalités de l'espace stagiaire :

- **Fil d'actualité** : les annonces publiées par le formateur y apparaissent sous forme de fil, avec possibilité pour les stagiaires de **commenter** une annonce et d'y réagir par un **"j'aime"** (fonctionnalité de publication d'annonce côté formateur reprise et enrichie depuis le prototype précédent)
- **Devoirs** : liste des devoirs assignés par module *(nouvelle notion à définir précisément — probablement liée aux travaux pratiques du référentiel officiel, avec une échéance et un statut de rendu ; à préciser lors du découpage fonctionnel détaillé)*
- **Contrôles** : consultation et passation des contrôles, organisés par module, désormais via le compte authentifié plutôt qu'un lien public partagé
- **Emploi du temps** : vue de son propre emploi du temps (séances de son groupe, dates de contrôles)
- **Supports de cours** : consultation des supports générés (§4.4), avec possibilité de **poser une question sur un support précis**, en pouvant **taguer/mentionner un camarade** dans la question ou la discussion

**Ce que le stagiaire ne fait PAS** : il ne consulte pas la progression détaillée du groupe (contenu prévu/réalisé séance par séance) — cette vue reste réservée au formateur (§4.6).

*Question ouverte : la notion de "devoir" n'a pas été détaillée dans le brief initial — à clarifier lors du passage au backlog (nature du rendu attendu : texte, fichier, lien ; notation ou non).*

### 4.6 Suivi de progression et rappel de contrôle (seuil des 30h)

- Progression trackée par couple groupe+module, séance par séance (contenu prévu vs contenu réalisé, statut)
- **Le seuil des 30h déclenche un rappel, jamais une génération automatique.** Quand le cumul d'heures dispensées sur un couple groupe+module atteint le seuil (typiquement 30h, ramené proportionnellement sur les modules de durée totale inférieure — voir point ouvert ci-dessous), l'app affiche simplement une alerte du type *"CC1 à préparer pour ce module"* (ou CC2 selon que le premier a déjà été fait). **L'app ne génère rien de son propre chef.**
- La préparation du contrôle reste **entièrement à l'initiative et sous le contrôle du formateur**, via l'interface décrite en §4.7 : le formateur ouvre l'interface de préparation, voit ce qui a été réellement vu par les stagiaires jusqu'à maintenant dans ce module, et **décide lui-même** du format (théorique, pratique, ou synthèse théorique+pratique) et du contenu — l'IA assiste la préparation à la demande, elle ne l'automatise pas.
- Contrainte réglementaire à respecter dans le modèle : **minimum 2 contrôles continus (CC) et 1 épreuve de fin de module (EFM), locale ou régionale, par module**
- Dashboard d'avancement par groupe et par module (repris et amélioré depuis la v1 déjà testée — cartes de statistiques clés, pas seulement un graphique)

*Point encore ouvert : le calcul exact du seuil proportionnel (30h sur un module standard, ramené à combien sur un module de 25h) reste à définir précisément — mais ce point ne concerne plus que le déclenchement du rappel, pas une génération, ce qui réduit l'enjeu de s'y tromper.*

### 4.7 Préparation de contrôles assistée par IA

- **Le formateur initie toujours la préparation lui-même** — il n'y a pas de génération automatique déclenchée par le seuil des 30h (voir §4.6), seulement un rappel qui l'invite à s'y mettre.
- **Deux types de contrôle, même mécanique de préparation, périmètre de contenu différent** :
  - **CC (contrôle continu)** : l'interface affiche ce que les stagiaires ont vu **jusqu'à maintenant** dans le module (séances au statut "réalisé" à cet instant) — le contrôle porte sur cette portion-là, pas sur tout le module.
  - **EFM (épreuve de fin de module)** : même interface et même logique, mais déclenchée **à la fin du module**, donc le contenu de référence affiché est **l'intégralité du module** (toutes les séances réalisées du début à la fin), pas une portion partielle.

- L'interface de préparation affiche donc d'abord le contenu réellement couvert — partiel pour un CC, complet pour un EFM — comme base de travail.
- Le formateur **choisit lui-même le format** du contrôle : théorique (QCM + questions ouvertes), pratique (avec grille d'évaluation, barème par critère), ou synthèse théorique + pratique combinée. L'app ne décide jamais du format à sa place, pour un CC comme pour un EFM.
- Une fois le format choisi, l'IA assiste la préparation à la demande (génère des questions, un barème, un corrigé proposés) mais **tout reste éditable et le formateur garde la main sur le contenu final** — l'app propose, le formateur dispose.
- Passation via le compte stagiaire authentifié (chronométrée), cohérent avec §4.5 — pas de lien public séparé. Correction assistée par IA avec justification du barème (leçons tirées des tests précédents : modèle de raisonnement séparé pour un rendu propre, validation du corrigé jamais exposée côté client, note toujours recalculée serveur)
- Export imprimable (PDF) du contrôle et du corrigé
- Traçabilité : le produit doit permettre de vérifier qu'un module a bien reçu son minimum réglementaire (2 CC + 1 EFM) avant la fin du module

**Règles réglementaires précises confirmées par le cahier du formateur officiel — à intégrer comme échéances/alertes dans le produit, pas juste comme texte informatif :**

*Contrôles continus (CC)* :

- La date doit coïncider avec une évolution significative de la formation (pas une date arbitraire)
- Minimum 2 CC par module (déjà noté)
- L'épreuve est préparée à l'avance par écrit, avec durée et barème définis
- Le corrigé est réalisé immédiatement après l'administration du CC
- Les notes doivent être restituées aux stagiaires **au plus tard à la 2ème séance suivant le CC**

*Épreuve de fin de module (EFM)* :

- Planifiée en début d'année (dates de proposition + dates d'administration)
- Doit intervenir à la fin du module ou **au plus tard 10 jours après son achèvement**
- Les propositions d'EFM sont conçues par le formateur puis **validées par une commission de formateurs de la spécialité, 20 jours avant l'administration**
- Les stagiaires sont informés à l'avance de la date et du lieu
- Copies corrigées et notes remises à la Direction Pédagogique **au plus tard 10 jours après l'administration**
- Résultats affichés aux stagiaires **au plus tard 15 jours après l'administration**

**Implication produit** : ces échéances alimentent une vraie fonctionnalité de calendrier, précisée en §4.9 et §4.10 — pas une simple amélioration future.

**Point de modélisation** : le champ `type_efm` (local/régional) vit désormais au niveau du module lui-même (§4.1), pas seulement du contrôle — voir §4.1 pour le rôle de priorisation que joue cette information, et §4.9-§4.10 pour son effet sur le calendrier.

### 4.8 Présences

- Prise de présence par séance, par stagiaire, liée au couple groupe+module+séance
- Vue agrégée par stagiaire (taux de présence sur le module / sur l'année) — utile en cas d'audit ou de suivi disciplinaire

### 4.9 Emploi du temps — motif hebdomadaire récurrent (moteur de génération) et page officielle

**Changement structurant v3.** Jusqu'ici, le PRD supposait que le formateur crée chaque séance une par une, à la main, avec sa date choisie au moment de la créer. Ce n'est pas comment ça se passe réellement : le formateur déclare **une fois** son rythme hebdomadaire — quel groupe, quel jour, quel créneau — et c'est ce rythme qui **génère automatiquement les séances à venir**, pas l'inverse.

**Exemple réel donné par le porteur de projet**, pour une semaine type :

| Jour | Créneau | Groupe |
|---|---|---|
| Lundi | 13h30–18h30 | DDOUX201 |
| Mardi | 8h30–13h30 | DDOUX201 |
| Mercredi | 13h30–18h30 | DDOUX201 |
| Jeudi | 8h30–13h30 | DDOUX201 |
| Vendredi | 8h30–11h00 | DES101 |
| Vendredi | 11h00–13h30 | DES102 |

**Ce motif n'est pas figé sur toute l'année.** Il peut changer d'une période à l'autre selon l'avancement des modules — le produit doit donc pouvoir gérer **plusieurs motifs successifs dans le temps** pour un même formateur (chacun avec sa date de début), pas un seul motif annuel immuable.

**Mécanisme de génération, pour un groupe donné à partir d'une date de début** (ex. DDOUX201 démarre le 07/09/2026) :

1. Le système avance semaine par semaine selon le motif hebdomadaire actif, en proposant une séance à chaque créneau du motif
2. Il **saute automatiquement les jours non travaillés** — jours fériés/vacances OFPPT, indisponibilités déclarées par le formateur (mission, absence médicale, engagement personnel — §4.10, ci-dessous)
3. Il attribue les séances générées au module en cours, dans l'ordre de la répartition horaire déjà prévue (§4.1, masse horaire allouée par module)
4. **Priorisation entre modules d'un même groupe** : à masse horaire équivalente, les modules à EFM régional (§4.1) devraient être proposés en premier dans la séquence, puisque leur échéance externe est fixe et non négociable — l'app doit au moins **signaler visuellement** quels modules du groupe sont à EFMR pour aider le formateur à choisir l'ordre, sans nécessairement l'imposer automatiquement en v1

**Prévisions calculées à partir de cette génération** :

- **Par module** : une date de fin prévisionnelle (ex. "M110 se termine le [date]"), déduite de sa masse horaire restante divisée par le rythme hebdomadaire réel qui lui est consacré
- **Par année complète** (1ère ou 2ème) : si tous les modules de l'année sont programmés dans le motif, une date de fin prévisionnelle cumulée pour l'ensemble de l'année

**Positionnement automatique des dates de contrôle** : une fois les séances générées, les dates estimées de CC1, CC2 et EFM local (§4.9 ancien contenu, repris ci-dessous) se calent sur ce calendrier réellement généré, pas sur une simple estimation déconnectée des vraies séances.

#### Page dédiée "Emploi du temps"

**Nouvelle page, distincte du calendrier opérationnel (§4.10 ci-dessous)** — c'est le document officiel équivalent à celui du classeur pédagogique papier (section I.B du cahier du formateur : période de validité, horaires, groupes concernés, modules à mettre en œuvre). Contenu :

- Le motif hebdomadaire actif, présenté en grille lisible (jours en colonnes, créneaux en lignes, groupe/module affiché dans chaque case occupée)
- Historique des motifs précédents si plusieurs se sont succédé dans l'année, avec leurs dates de validité respectives
- **Export PDF**, mise en page soignée, dans un format proche du document officiel que l'administration attend — pour impression ou dépôt dans le classeur pédagogique

### 4.10 Calendrier opérationnel (vue semaine)

- Calendrier des jours fériés et vacances OFPPT, préchargé (source à définir — saisie manuelle initiale probable, l'OFPPT ne semble pas exposer d'API)
- Déclaration d'absence (ex. maladie) qui se reflète visuellement dans le calendrier — impacte potentiellement le recalcul de la progression prévue et régénère les projections de fin de module (§4.9 ci-dessus)
- Distinction séances présentiel / à distance visible dans le calendrier

**Calendrier des contrôles par module.**

Pour chaque module en cours, l'app affiche une **estimation des dates prévisionnelles de CC1, CC2, et EFM**, calculée à partir des séances réellement générées par le motif hebdomadaire (§4.9 ci-dessus), pas d'une simple estimation de rythme moyen. Le comportement diffère selon le type d'EFM du module :

- **Module à EFM local (EFML)** : la date d'EFM peut être **estimée par l'app**, comme les CC — c'est une échéance interne, liée uniquement au rythme d'avancement du module.
- **Module à EFM régional (EFMR)** : la date **ne peut jamais être estimée par l'app**, car elle est fixée par la Direction Régionale et communiquée par email au formateur, en dehors de l'application. Deux champs à saisir manuellement dès réception de cette communication :
  - La **date d'envoi attendue des propositions d'EFM** (deadline de préparation communiquée par la Direction)
  - La **date exacte de l'épreuve**

  Une fois ces deux dates saisies, l'app programme les rappels correspondants (échéance de préparation à l'approche, jour de l'épreuve, délais de restitution des notes — §4.7) exactement comme elle le ferait pour une date estimée automatiquement.

**Implication sur le modèle de données** : le calendrier des contrôles distingue visuellement les dates **estimées** (CC1, CC2, EFML) des dates **confirmées manuellement** (EFMR) — pour que le formateur sache toujours si une date affichée est une prévision ou une échéance ferme.

### 4.11 Masse horaire réglementaire et découpage horaire des séances

Point réglementaire à respecter dans le produit, distinct de la gestion pédagogique pure :

**Plafonds légaux**

- Masse horaire légale annuelle : **910 heures/an**, soit une moyenne de **26 heures/semaine**
- Heures supplémentaires possibles, dans la limite de **30 heures/mois**, avec un plafond annuel de **260 heures** — soit un maximum théorique de **1170 heures/an** (910 + 260) si le plafond d'heures sup est entièrement utilisé
- Le rythme hebdomadaire n'est pas fixe sur l'année : l'administration démarre généralement à **27,5h/semaine** en début d'année et le réduit progressivement jusqu'à **25h/semaine** en fin d'année — le produit doit donc pouvoir suivre un rythme hebdomadaire cible variable dans le temps, pas une moyenne constante
- Règle à ne jamais violer dans les alertes/calculs : ne pas dépasser les 910h légales, sauf couverture explicite par des heures supplémentaires restant sous le plafond de 260h/an et 30h/mois

**Implication produit** : le calendrier (§4.10) doit inclure un **suivi cumulatif des heures dispensées** — par semaine, par mois, par année — avec distinction heures normales / heures supplémentaires, et une alerte si le cumul approche ou dépasse un plafond (hebdomadaire cible, mensuel de 30h supplémentaires, ou annuel de 910h/1170h). Ce suivi se nourrit directement des séances effectivement réalisées.

**Découpage horaire des séances**

- Le cahier du formateur officiel précise : la durée d'une séance varie **de 1 heure à 5 heures**, avec deux repères — séances théoriques généralement autour de 3h maximum, séances pratiques généralement à partir de 2h minimum. **Ce ne sont pas des règles à valider strictement dans le produit** : le formateur organise sa séance comme il l'entend, l'app ne doit pas bloquer une saisie qui s'en écarte.
- Dans la pratique réelle, ça arrive mais pas systématiquement — le schéma le plus courant est de diviser le bloc de la journée en une **séance théorique et une séance pratique**, souvent **2h30 + 2h30**. Autre découpage fréquent : le bloc est plutôt scindé **par groupe** plutôt que par type de contenu — 2h30 pour DES101 et 2h30 pour DES102 dans la même journée.
- **Un bloc horaire journalier peut chevaucher deux modules différents**, indépendamment du découpage théorique/pratique ou par groupe.

**Créneaux horaires standards de la journée**, à utiliser comme référence pour l'interface de calendrier/emploi du temps :

| Bloc | Horaire | Pause interne |
|---|---|---|
| Matin | 8h30 – 13h30 (~5h) | 10h45 – 11h00 (15 min) |
| Soir | 13h30 – 18h30 (~5h) | 15h45 – 16h00 (15 min) |

Chaque bloc de demi-journée (matin ou soir) représente environ 5 heures, avec une pause interne de 15 minutes. **Ce n'est pas une règle fixe qui découpe automatiquement 4 séances** : selon l'emploi du temps réel assigné par la Direction Pédagogique, un bloc de demi-journée peut être :

- **Une seule séance continue** de ~5h sur un seul module/groupe (la pause de 15 min n'interrompt pas la séance, elle est juste une coupure de confort)
- **Scindée en deux séances** de ~2h15-2h30 chacune, sur deux modules différents, ou sur deux groupes différents (ex. 2h30 pour DES101 puis 2h30 pour DES102)

L'interface de création de séance doit donc proposer ces deux blocs (matin/soir) comme point de départ pratique, avec la possibilité de les garder entiers ou de les diviser en deux séances — reflétant fidèlement ce que l'emploi du temps réel du formateur indique ce jour-là, plutôt que d'imposer un découpage fixe.

**Implication sur le modèle de données** : une "séance" ne doit pas être modélisée comme un simple événement journalier lié à un seul couple groupe+module. Elle doit porter une **heure de début et une heure de fin précises**, et la journée d'un formateur peut contenir **plusieurs séances successives rattachées à des modules différents** dont la somme des durées correspond au bloc horaire réel (ex. 3h sur le module A + 2h sur le module B = bloc de 5h). C'est cette granularité horaire précise — pas seulement la date — qui doit alimenter :

- La génération de la **fiche de préparation** (générée pour la durée exacte de la séance, pas pour une durée de module générique)
- Le calcul de progression et de **seuil de contrôle** (§4.6), qui s'appuie sur les heures réellement dispensées par module
- La génération de **contrôles**, dont la durée doit correspondre à un temps de passation cohérent avec le temps réellement disponible

### 4.12 Banque de questions des stagiaires (archive pluriannuelle)

- Les questions posées par les stagiaires (sur les supports de cours, éventuellement sur les contrôles) sont conservées d'année en année
- Objectif exprimé par le porteur de projet : réutiliser cette base au fil du temps pour enrichir la plateforme — probablement pour affiner la génération IA future ou constituer une FAQ par module. *Le mécanisme exact de réutilisation (FAQ affichée, enrichissement du prompt IA, autre) reste à préciser — à ne pas sur-spécifier en v1, prévoir seulement la structure de conservation.*

### 4.13 Export "classeur pédagogique"

- Export téléchargeable regroupant, a minima, les fiches de préparation d'un module/groupe sur une période, dans un format proche du classeur pédagogique papier existant
- Usage principal : audits internes OFPPT sur les fiches de préparation
- *Question ouverte : le format exact du classeur pédagogique n'a pas encore été fourni — section à préciser à réception de l'exemple annoncé par le porteur de projet.*

### 4.14 Module stage / soutenance (compétence 16 — dernière du programme)

Traité différemment des autres modules, car il ne suit pas le schéma séance/fiche de préparation classique :

- Suivi du stage (dates, entreprise, tuteur)
- Dépôt/suivi des documents requis : contrat de stage signé, attestation de stage, note d'évaluation du tuteur

**Structure de notation confirmée par le document de soutenance officiel reçu** — deux grilles distinctes, chacune sur 20 points :

| Grille | Critères | Répartition |
|---|---|---|
| **Rapport** (évalué par le formateur) | Présentation (qualité d'expression écrite, respect des normes de présentation) | /8 |
| | Contenu (capacité à rendre compte de la mission, capacité de synthèse) | /12 |
| **Exposé / Soutenance** (évalué par un jury) | Fond (présentation de l'entreprise et du contexte, mise en évidence des points clés) | /14 |
| | Forme (attitude durant l'exposé, qualité de l'expression et de l'argumentation, gestion du temps) | /6 |

Chaque grille inclut une échelle d'appréciation standardisée (16-20 très bon niveau, 13-15 bonne qualité, 10-12 satisfaisant avec progrès à réaliser, 0-9 insuffisant), et l'exposé mentionne les noms et qualités des membres du jury.

*Question ouverte : le document ne précise pas la formule de calcul de la "note générale" finale de stage à partir de ces trois éléments (note de rapport, note d'exposé, note du tuteur) — à clarifier avec le porteur de projet (moyenne simple, pondération différente, ou les trois conservées séparément sans note unique calculée par l'app).*

---

## 5. Hors périmètre (v1)

Pour garder une v1 réalisable, sont explicitement exclus dans un premier temps :

- Interface dédiée pour un administrateur OFPPT (l'export classeur pédagogique en PDF/impression suffit)
- Gestion multi-formateurs avancée (permissions fines par rôle) — la structure de données le permet, mais l'UI v1 reste pensée pour un formateur unique
- Intégration automatique du calendrier OFPPT (pas d'API connue) — saisie manuelle en v1
- Mécanisme précis de réutilisation de la banque de questions pour enrichir l'IA (structure de conservation seulement, en v1)

---

## 6. Contraintes non-fonctionnelles

Tirées des enseignements du prototype précédent (audit de code réalisé sur une v1 test) :

- **Sécurité** : toute donnée sensible (notes, corrigés) protégée par des policies restreintes au propriétaire réel, jamais de règle d'accès ouverte par défaut ; aucune note ou statut de correction accepté tel quel depuis le client, toujours recalculé côté serveur ; tout endpoint public a une limite de débit
- **Fiabilité de génération IA** : toute génération de contrôle ou de fiche reste éditable par le formateur avant validation — l'IA assiste, ne décide jamais seule d'une note finale ou d'un contenu publié sans relecture
- **Cohérence de conception** : le projet suit un système de design et un fichier de conventions techniques dès le départ (approche déjà mise en place et éprouvée sur le prototype précédent), pour éviter la dérive observée lors d'un développement par IA en tâches indépendantes

---

## 7. Glossaire OFPPT

| Terme | Définition |
|---|---|
| **Compétence** (= "Module" en terminologie officielle) | Unité du programme de formation, numérotée et codée (ex. `DIA_DESOUX_TS-06`), avec une durée nationale de référence et une répartition théorique/pratique/évaluation. Le programme UX Designer en compte 16, totalisant 1435h |
| **Module (code opérationnel)** | Identifiant court utilisé au quotidien par le formateur (ex. `M106`), correspondant à une compétence précise du programme officiel |
| **Unité** | Étalon de valeur d'un module dans le programme, équivalant à 15 heures de formation, utilisé pour l'accumulation de points vers un diplôme |
| **Fiche prescrite** | Document officiel décrivant une compétence : contexte de réalisation, critères de performance, éléments de la compétence |
| **Suggestions pédagogiques** | Document officiel détaillant, pour chaque élément de compétence, les apprentissages de base, contenus, activités et durées suggérées |
| **Logigramme de la filière** | Document qui articule l'ordre des modules et leur rythme d'avancement prévu (masse horaire hebdomadaire, nombre de semaines par module) |
| **APC / reAPC** | Approche par compétences — méthode pédagogique de référence à l'OFPPT |
| **CC** | Contrôle continu |
| **EFM** | Épreuve de fin de module (locale ou régionale) |
| **Classeur pédagogique / Cahier du formateur** | Dossier physique/numérique regroupant la planification et le suivi de la formation et des évaluations d'un formateur, consulté lors des audits |
| **Émargement** | Validation signée du Directeur Pédagogique sur certains documents de planification (emploi du temps, tableaux de modules) — process administratif papier, hors périmètre applicatif direct en v1 |

---

## 8. Prochaines étapes

1. Validation de ce PRD par le porteur de projet
2. **Points restant à trancher avant le passage au code** (signalés en ligne dans les sections concernées) :
   - Calcul exact du seuil de contrôle proportionnel (30h réactif à une durée de module inférieure, ex. 25h) — §4.6
   - Formule de calcul de la note générale de stage à partir des notes de rapport, d'exposé et du tuteur — §4.14
   - Nature précise de la fonctionnalité "devoirs" côté stagiaire (type de rendu, notation) — §4.5
3. Une fois validé, découpage en backlog atomique (même méthode que le prototype précédent) avec `docs/design_system.md` et `docs/conventions.md` posés dès le départ