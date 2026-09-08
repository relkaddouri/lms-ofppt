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

**Règle de calcul non négociable, confirmée par le document officiel "Tableau de service" (§4.13bis) : toute statistique de masse horaire totale affichée dans l'app doit sommer les masses horaires allouées par couple groupe+module, jamais les durées de référence des modules.** Un module enseigné à deux groupes compte deux fois, avec sa valeur propre à chaque groupe — le confondre avec la somme des durées de référence (un seul total par module, peu importe le nombre de groupes) donne un chiffre faux, comme démontré par l'écart entre 690h (durées de référence sommées) et 920h (le vrai total du document officiel).

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

**Principe pédagogique fondateur — ajout v3, non négociable.** L'objectif pédagogique de la fiche doit être formulé selon les principes de la **pédagogie active** et de l'**Approche Par Compétences (APC)** — jamais un objectif de simple transmission passive de connaissance. **Tout le reste de la fiche existe pour servir cet objectif** : le contenu, les méthodes, le déroulement (§4.3ter) ne sont pas des sections indépendantes juxtaposées, ils sont subordonnés à l'atteinte de cet objectif précis.

**Variété obligatoire des méthodes actives.** La génération IA ne doit jamais s'appuyer sur une seule méthode de pédagogie active répétée séance après séance (ex. toujours "questions-réponses") — elle doit **varier** les méthodes mobilisées (étude de cas, travail en sous-groupes, brainstorming, jeu de rôle, résolution de problème, démonstration suivie de pratique guidée, etc.) selon ce qui convient le mieux au contenu de la séance, et en tenant compte des méthodes déjà utilisées dans les séances récentes du même module pour ne pas tomber dans la répétition.

**Continuité obligatoire avec les séances précédentes — renforcé v3.** Ce n'est pas seulement une question d'éviter les répétitions de contenu (déjà couvert ci-dessus) : la génération doit activement **prendre appui sur les compétences déjà développées** dans les séances précédentes du même groupe+module pour construire la suite logique de la progression pédagogique. Si 5 séances ont déjà eu lieu, la 6ème doit s'appuyer explicitement sur ce que ces 5 séances ont construit chez les stagiaires — pas repartir sur une base neutre comme si c'était la première séance du module.

Implication pour le prompt de génération IA (§7, à préciser lors du backlog) : contraindre explicitement le modèle à produire un schéma court plutôt qu'un texte développé, avec une limite de longueur/densité pour éviter qu'il "déborde" vers un cours complet malgré la consigne — et à ne jamais s'écarter des éléments de contenu assignés à la séance, ni en omettre, ni en inventer d'autres.

### 4.3bis Contenu pédagogique partagé entre groupes parallèles (ajout v3)

**Constat du porteur de projet** : quand deux groupes suivent le même module au même point du programme avec un contenu identique — typiquement DES101 et DES102 en tronc commun sur un module comme M104 — regénérer une fiche de préparation séparée par IA pour chaque groupe est un pur gaspillage. Le contenu pédagogique (objectif, éléments de contenu couverts, aide-mémoire) est **strictement le même** pour les deux groupes à ce point du parcours, même si leurs séances ont des dates et horaires différents (ex. le motif place DES101 le vendredi 8h30-11h00 et DES102 le vendredi 11h00-13h30, séparément).

**Règle** : pour deux séances de groupes parallèles couvrant le même contenu au même point du programme, **la fiche de préparation est un contenu partagé** — générée une fois, pas dupliquée ni régénérée séparément pour chaque groupe. Modifier la fiche depuis l'une des deux séances la met à jour pour l'autre également.

**Ce qui reste propre à chaque séance, jamais partagé** :
- **Présences** — évidemment distinctes, ce sont des élèves physiquement présents à des moments différents
- **Remarques de séance** — spécifiques à ce qui s'est réellement passé dans cette séance précise
- Les **dates, horaires et statut** (faite/à faire) de chaque séance, qui restent des instances distinctes

**Ce qui reste délibérément séparé, à l'inverse de la fiche — exception explicite** : les **contrôles** (CC/EFM) continuent d'être générés en **versions différentes pour chaque groupe**, même sur un contenu identique. Ce n'est pas un oubli, c'est voulu — ne jamais appliquer la logique de partage de la fiche aux contrôles.

*Point ouvert, à trancher techniquement lors du backlog : le mécanisme exact de partage (une fiche liée à plusieurs séances via une relation plusieurs-à-plusieurs, ou une séance "source" et une séance "miroir" qui pointe vers la fiche de la première) dépend de l'état réel du schéma — la même question s'était posée pour le partage de séance FAD (§4.1bis) et avait été tranchée après mesure de l'impact réel sur le code existant. À traiter avec la même rigueur.*

**Support de cours (§4.4) — même logique, confirmée par le porteur de projet.** Le support de cours généré pour une séance repose sur le même contenu que sa fiche de préparation — la même règle de partage s'applique entre séances parallèles (DES101/DES102) : généré une fois, pas dupliqué, modifiable depuis l'une ou l'autre séance avec répercussion immédiate sur les deux.

### 4.3ter Déroulement de séance guidé — mode présentation en temps réel (ajout v3)

**Changement de mission, formulé directement par le porteur de projet** : *"la mission de cette app est de m'aider dans le déroulement de la séance, pas juste [produire] une fiche comme ça."* La fiche de préparation (§4.3) reste un document de préparation en amont — mais l'app doit aussi offrir un **mode d'exécution en temps réel**, consulté pendant que la séance se déroule, pas seulement avant.

**Principe d'usage** : le formateur doit pouvoir suivre ce mode "comme une présentation, avec tout devant lui" — sans avoir à deviner quoi faire ni à dépenser de l'énergie mentale à reconstruire le déroulement depuis l'aide-mémoire. Il lit ce qui s'affiche, il l'applique, il passe à la phase suivante.

**Structure — tranchée v3, quatre phases fixes et linéaires** :

| Phase | Part indicative | Contenu affiché |
|---|---|---|
| **Mise en situation** | ~10% | Le déclencheur (problème, question, contexte) + les questions d'accroche |
| **Activité / exploration** | ~50% | La consigne de l'activité, la composition des groupes le cas échéant, ce qu'il faut observer pendant que les stagiaires cherchent |
| **Structuration** | ~25% | Les notions à nommer, dans l'ordre, les erreurs typiques à reprendre — **cette phase est nourrie directement par les critères particuliers de performance du référentiel officiel** (`criteres_particuliers_performance`, déjà en base depuis la Phase 1), pas par du contenu inventé par le modèle |
| **Réinvestissement** | ~15% | Une nouvelle situation courte, dans un contexte différent, pour vérifier le transfert |

**Choix délibéré : schéma unique, strictement linéaire, aucune phase conditionnelle.** Une variante examinée (déclenchement d'une phase seulement "si la moitié des groupes bloque") a été écartée : elle demanderait un jugement en temps réel de la part du formateur, ce qui contredit directement le principe d'usage ci-dessus — voir ce qui est affiché et l'appliquer, sans avoir à décider si une condition est remplie. Le même schéma s'applique aux séances théoriques et pratiques, pas de variante séparée par nature de séance.

**Remplace, ne s'ajoute pas.** La génération de fiche produit aujourd'hui une structure implicite différente (motivation/plan/développement/évaluation/prochaine, avec des minutes par bloc) qui contredit la décision de format synthétique déjà prise (§4.3). Cette ancienne structure doit être **remplacée** par les quatre phases ci-dessus, jamais conservée en parallèle — sinon la fiche et le mode présentation racontent deux déroulements différents de la même séance.

Pour chaque phase, l'écran affiche :
- La méthode active mobilisée pour cette phase précise, variée d'une séance à l'autre (§4.3)
- Les **instructions concrètes** à suivre
- Les **questions précises à poser** aux stagiaires, prêtes à l'emploi
- Tout autre élément nécessaire pour exécuter cette phase sans préparation supplémentaire
- Une action pour marquer la phase terminée et passer à la suivante

**Repères temporels dans la phase — ajout v3.** Au-delà de la durée totale indicative d'une phase, l'écran doit signaler des **moments d'action précis à l'intérieur de la phase**, pas seulement un décompte silencieux — par exemple : à 5 minutes de la fin, un rappel "Prévenez les stagiaires qu'il reste 5 minutes" ; à la moitié du temps, une invite à vérifier l'avancement des groupes ; en fin de phase, un rappel explicite du moment où demander le rendu du travail. Ce n'est pas un chronomètre passif — c'est un guide qui dit au formateur *quand* agir, pas seulement combien de temps s'est écoulé. Le nombre et la nature de ces repères dépendent de la phase (une phase d'activité longue en a besoin, une phase de mise en situation courte moins).

**Exigence d'UX/UI** : cet écran doit être pensé comme un mode présentation — épuré, une phase à la fois visible en priorité, navigation simple entre phases (précédent/suivant), lisible d'un coup d'œil pendant que le formateur anime sa classe. Ce n'est pas un document à relire, c'est un support d'exécution.

### 4.4 Génération IA de support de cours (16:9)

- Pour les modules où le formateur ne dispose pas de cours existant (typiquement les modules de 2ème année, selon le porteur de projet), génération d'un support de type diaporama (16:9), aligné sur le contenu de la fiche de préparation de la séance
- Le support est consultable par les stagiaires depuis leur espace (§4.5), avec possibilité de poser des questions dessus

**Cohérence stricte entre fiche et support — ajout v3, non négociable.** Tout document, vidéo, lien ou ressource **mentionné dans la fiche de préparation** doit être **effectivement présent et trouvable dans le support** — pour la partie théorique comme pour la partie pratique. Si la fiche évoque "voir la vidéo sur X" ou "document de référence Y", ce n'est jamais une référence dans le vide : le support doit contenir cette ressource ou un lien direct vers elle. La génération IA du support doit lire la fiche associée et s'assurer que toutes ses références y sont honorées.

**Deux supports par séance — ajout du 8 septembre 2026, demande du porteur de projet.** Le formateur prépare deux documents distincts, et l'application n'en portait qu'un. Le **support du stagiaire** est celui qui est remis : il dit ce qu'il faut retenir, il est lisible dans l'espace stagiaire, il porte les questions qu'on lui pose. Le **support du formateur** est le sien : conduite de séance, réponses attendues, ce qu'il projette pour lui. Il n'est **jamais servi à un stagiaire**, et cette garantie est portée par la policy de lecture, pas par un filtre applicatif.

Les deux sont le même objet à tous les autres égards : même rédaction markdown, même génération, même diaporama 16:9, mêmes PDF, même historique de versions, même partage entre séances parallèles. Ils se distinguent par leur destinataire, par leur onglet, et par le pied de page et le nom de fichier de leurs documents — deux PDF de la même séance ne doivent pas se confondre dans un dossier de téléchargements.

**Support riche — pas un contenu minimal.** Le support ne doit pas se limiter à du texte brut : la génération doit intégrer, quand c'est pertinent, des **schémas, images, liens vers des articles de référence** et tout élément qui approfondit et enrichit l'explication. L'objectif est un support que le stagiaire peut consulter en autonomie et qui reste utile même hors de la présence du formateur, pas juste un squelette de diaporama.

**Deux documents distincts par module — support théorique et support pratique**, tranché par le porteur de projet :
- **Support du cours** — la compilation du contenu théorique, dans l'ordre logique des séances
- **Support de TP** ("Pratique de [Module]", ex. "Pratique de M202") — regroupe tous les travaux pratiques du module. **Génère une proposition de correction ou des pistes de correction pour chaque TP**, disponible pour le formateur au moment où il marque la séance correspondante comme terminée — pas générée à l'avance et exposée aux stagiaires avant que le TP soit fait.

**Partage de la correction — décision manuelle du formateur, pas une règle automatique.** La correction est **fermée par défaut** aux stagiaires, y compris après que la séance est marquée faite. Le formateur dispose d'une action explicite ("Partager avec les stagiaires") pour l'ouvrir quand il le juge pertinent — après avoir corrigé les copies, par exemple, ou jamais s'il préfère garder la correction pour son seul usage. Une fois partagée, elle reste visible ; la revenir en arrière ne doit pas effacer ce qu'un stagiaire a potentiellement déjà vu, mais peut empêcher un accès futur si le formateur retire le partage. Cette décision se prend **par correction**, pas globalement pour tout le module — un formateur peut vouloir partager la correction d'un TP et garder celle d'un autre pour lui.

**Compilation au niveau du module — export complet.** Une fois un module terminé (ou à tout moment en cours de route), le formateur doit pouvoir **télécharger le support complet du module** — la compilation de toutes les séances dans l'ordre logique du programme, pas seulement consulter un support séance par séance de façon fragmentée. Distinct du classeur pédagogique (§4.13, qui regroupe les fiches de préparation) : ici il s'agit du contenu de cours et de TP destiné aux stagiaires.

**Vue stagiaire — support complet ou progressif.** Le stagiaire doit pouvoir consulter soit le support complet du module (s'il est disponible), soit une vue qui reflète sa progression réelle — si 5 séances ont eu lieu, il voit un cours cohérent qui suit la logique de ce qui a été couvert jusqu'ici, pas un accès prématuré à du contenu pas encore enseigné en classe.

**Regroupement des ressources liées à une séance, côté stagiaire.** Tout ce qui se rattache à une séance donnée — support de cours, support de TP, documents, liens, instructions — doit être **retrouvable au même endroit** depuis l'espace stagiaire, plutôt que dispersé. Ce qui est assigné comme devoir doit apparaître dans la vue "Devoirs" du stagiaire (§4.5) avec un lien clair vers la séance et ses ressources d'origine.

**Rédaction manuelle en markdown — alternative obligatoire à la génération, ajout v3.** La génération IA ne doit jamais être le seul chemin pour produire un support de cours ou une grille de correction. Le formateur doit pouvoir, à tout moment, **écrire ou coller son propre contenu en markdown** à la place d'une génération — pas une fonctionnalité secondaire, une alternative de même niveau. Le contenu, qu'il soit généré ou rédigé à la main, est stocké en markdown et **rendu à l'écran et dans les PDF avec exactement le même traitement visuel** (typographie, couleurs, mise en page du design system) — la source de la rédaction ne doit jamais se voir dans le résultat. Ça s'applique aux deux documents (support de cours et grille de correction du support de TP), sans exception.

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
- Contrainte réglementaire à respecter dans le modèle : **minimum 2 contrôles continus (CC) et 1 épreuve de fin de module (EFM), locale ou régionale, par module** — c'est un plancher, pas une valeur fixe (voir §4.6bis pour la configuration réelle par module).
- Dashboard d'avancement par groupe et par module (repris et amélioré depuis la v1 déjà testée — cartes de statistiques clés, pas seulement un graphique)

*Point encore ouvert : le calcul exact du seuil proportionnel (30h sur un module standard, ramené à combien sur un module de 25h) reste à définir précisément — mais ce point ne concerne plus que le déclenchement du rappel, pas une génération, ce qui réduit l'enjeu de s'y tromper.*

### 4.6bis Nombre et durée des contrôles — abandonné, forfait fixe conservé (retiré v3)

**Annulé par le porteur de projet, après réflexion — le forfait fixe reste la règle définitive, pas une simplification provisoire.** Cette section avait initialement demandé un nombre et une durée de CC/EFM configurables par module (voir historique de version), avec la logique `(nombre_CC × durée_CC) + durée_EFM`. Le porteur de projet est revenu sur cette demande : **le forfait fixe de 10h par module (2 CC de 2h30 + 1 EFM de 5h) est conservé tel quel**, y compris sur les modules de grande masse horaire.

Ce n'est pas un bug ni un oubli — la section est volontairement retirée, gardée ici pour ne pas revenir comme une redécouverte plus tard. Le comportement actuel du produit (`lib/repartition.ts`, forfait 10h fixe) est **conforme** à cette décision, aucune correction n'est due dessus.

### 4.7 Préparation de contrôles assistée par IA

- **Le formateur initie toujours la préparation lui-même** — il n'y a pas de génération automatique déclenchée par le seuil des 30h (voir §4.6), seulement un rappel qui l'invite à s'y mettre.
- **Deux types de contrôle, même mécanique de préparation, périmètre de contenu différent** :
  - **CC (contrôle continu)** : l'interface affiche ce que les stagiaires ont vu **jusqu'à maintenant** dans le module (séances au statut "réalisé" à cet instant) — le contrôle porte sur cette portion-là, pas sur tout le module.
  - **EFM (épreuve de fin de module)** : même interface et même logique, mais déclenchée **à la fin du module**, donc le contenu de référence affiché est **l'intégralité du module** (toutes les séances réalisées du début à la fin), pas une portion partielle.

- L'interface de préparation affiche donc d'abord le contenu réellement couvert — partiel pour un CC, complet pour un EFM — comme base de travail.
- Le formateur **choisit lui-même le format** du contrôle : théorique (QCM + questions ouvertes), pratique (avec grille d'évaluation, barème par critère), ou synthèse théorique + pratique combinée. L'app ne décide jamais du format à sa place, pour un CC comme pour un EFM.
- Une fois le format choisi, l'IA assiste la préparation à la demande (génère des questions, un barème, un corrigé proposés) mais **tout reste éditable et le formateur garde la main sur le contenu final** — l'app propose, le formateur dispose.

**Barème total — règle explicite, corrigée v3 : le total dépend du type, pas une constante unique.** Un CC se barème sur **20 points**. Un EFM (local ou régional, peu importe) se barème sur **40 points** — le double, pas 20. Toute validation de barème (à l'écran, dans l'IA de préparation, dans le contrôle de cohérence avant validation) doit se référer au total attendu **selon le type du contrôle en cours de préparation**, jamais une valeur fixe de 20 codée en dur. Un contrôle CC dont le barème ne tombe pas sur 20, ou un EFM dont le barème ne tombe pas sur 40, doit être signalé de la même façon (la règle de validation existe déjà, seul le seuil de référence doit devenir variable).

**Cohérence entre le barème d'une question et sa difficulté réelle — ajout v3.** Le nombre de points attribué à une question ne doit jamais être arbitraire : une question à difficulté élevée (raisonnement complexe, plusieurs étapes, mobilisation de plusieurs notions) doit porter un barème clairement supérieur (ex. 6 points) à une question simple de restitution directe (ex. 1 à 2 points). L'IA de génération doit justifier explicitement, pour chaque question proposée, pourquoi le barème choisi correspond au niveau de difficulté de la question — pas seulement produire des chiffres qui totalisent le bon total général.

**Courbe de difficulté calibrée pour toute la classe — principe pédagogique explicite, ajout v3.** Un contrôle bien conçu n'est pas uniformément difficile : il doit permettre à **l'ensemble de la classe** d'atteindre un socle minimal (**12/20 pour un CC, 24/40 pour un EFM** — soit 60% du total dans les deux cas) via des questions fondamentales et accessibles, tandis qu'une **portion plus réduite du barème** (les 40% restants) porte sur des questions plus difficiles, destinées à **distinguer les meilleurs stagiaires**, pas à faire échouer la majorité de la classe. L'IA de génération doit répartir consciemment les questions selon cette logique — une majorité de points sur des questions accessibles, une minorité de points sur des questions réellement discriminantes — et non générer un ensemble de questions de difficulté homogène ou aléatoire. Cette règle s'applique quel que soit le format (théorique, pratique, mixte).

- Passation via le compte stagiaire authentifié (chronométrée), cohérent avec §4.5 — pas de lien public séparé. Correction assistée par IA avec justification du barème (leçons tirées des tests précédents : modèle de raisonnement séparé pour un rendu propre, validation du corrigé jamais exposée côté client, note toujours recalculée serveur)
- Export imprimable (PDF) du contrôle et du corrigé
- Traçabilité : le produit doit permettre de vérifier qu'un module a bien reçu son minimum réglementaire (2 CC + 1 EFM) avant la fin du module

**Publication du résultat — décision manuelle du formateur, jamais immédiate, ajout v3.** Après avoir remis sa copie, le stagiaire **ne voit rien** — ni note, ni corrigé, ni indication d'un résultat en attente au-delà de la confirmation d'envoi. Le résultat n'apparaît que lorsque le formateur le publie explicitement, après avoir relu et validé la correction (même principe que le partage manuel de la grille de correction de TP — une action délibérée, jamais un affichage automatique dès la correction calculée côté serveur).

**Forme du résultat publié — un document imprimé, pas un écran.** Une fois publié, le résultat s'exporte comme un **document PDF destiné à l'impression**, avec deux zones de signature manuscrite distinctes : une pour le formateur, une pour le stagiaire. Ces zones n'existent que dans le document imprimé — ce n'est pas une signature numérique capturée dans l'app, le stagiaire signe à la main sur le papier, comme un document administratif classique. La zone de signature du stagiaire porte un texte d'attestation, imprimé au-dessus de la ligne de signature :

> *"Je soussigné(e) [Nom du stagiaire], déclare avoir pris connaissance du présent résultat, vérifié le recalcul des points obtenus, et atteste qu'il est exact."*

Ce texte sert de preuve de vérification contradictoire, utile au formateur face à la Direction en cas de contestation ultérieure sur une note. *Formulation proposée à valider par le porteur de projet — modifiable avant l'implémentation si le libellé ne convient pas exactement.*

**Ce que le document doit contenir pour que l'attestation ait un sens — ajout du 8 septembre 2026, demande du porteur de projet.** Le stagiaire déclare avoir « vérifié le recalcul des points » : il faut donc qu'il ait de quoi vérifier. Sous chaque question, le document porte l'énoncé complet, les points obtenus sur le barème, **la réponse qu'il a écrite**, **la réponse attendue** et **le commentaire du formateur sur cette question**. Un relevé de notes sans ces trois éléments ne se vérifie pas : il se subit. Une question ne se coupe jamais entre deux pages, faute de quoi le commentaire se retrouve orphelin en tête de page et manque à celui qui relit avant de signer.

**Le dossier d'épreuve — ajout du 8 septembre 2026, demande du porteur de projet.** Les résultats d'un contrôle s'éditent **en un seul fichier** plutôt qu'un par stagiaire : le formateur qui publie une classe lance une impression, pas vingt-cinq. Chaque résultat y garde ses propres pages et sa propre numérotation — « page 2 / 2 » et non « page 14 / 31 » — parce que le stagiaire reçoit ses feuilles détachées du reste et doit pouvoir vérifier qu'il les a toutes.

Le dossier s'ouvre sur une **page de garde**, toujours présente : elle se détache pour être collée sur la chemise cartonnée qui part à l'administration, et se lit donc à un mètre — panneau d'annonce, trois chiffres (effectif, copies au dossier, moyenne du groupe), identification aérée, contenu du paquet, signature du formateur. Sa composition ne reprend pas le cartouche des pièces qu'elle annonce : là tout est également important et se parcourt du regard, ici trois choses comptent.

Vient ensuite une **feuille d'émargement**, que le formateur choisit de joindre ou non par une case à cocher, et qui se télécharge aussi seule — elle s'imprime avant l'épreuve, pour être signée pendant. Elle tient sur **une page**, porte le même cartouche que les résultats, et liste **les stagiaires du groupe** — non ceux qui ont rendu : c'est une feuille de présence, l'absence s'y constate. Cinq colonnes : numéro, CEF, nom et prénom, émargement, observation ; la signature du formateur ferme la page.

Le document porte en tête un **cartouche d'identification** — établissement, filière, année scolaire, groupe, formateur et matricule, module, épreuve, date et horaire — et le fichier téléchargé se nomme `NOM-STAGIAIRE_MODULE_CEF_ÉPREUVE_DATE`, convention arrêtée par le porteur de projet le 8 septembre 2026. La date y est en ISO pour se trier chronologiquement ; un segment sans valeur disparaît plutôt que de laisser un trou. **L'horaire n'est jamais saisi** : il se lit dans l'emploi du temps — la séance du jour donne l'heure de début, la durée du contrôle donne la fin.

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

**Règle non négociable — remplissage complet de chaque créneau, ajout v3.** Chaque créneau du motif doit être **entièrement occupé** par une séance, jamais partiellement. Ce n'est pas une question d'esthétique : le formateur doit déclarer sur la plateforme officielle OFPPT (E-note) le nombre d'heures réellement travaillées par semaine et par module — si l'app génère une séance de 2h30 dans un créneau de 5h, les 2h30 restantes du créneau n'existent nulle part, ni dans l'app ni dans la déclaration réelle. Le total d'heures généré sur une semaine pour un couple groupe+module doit correspondre exactement à ce que le motif alloue à ce couple sur cette semaine.

**Mécanisme de remplissage — les objectifs se combinent pour occuper un créneau, jamais l'inverse.** La séquence de contenu à placer suit l'ordre pédagogique : les éléments de compétence dans leur ordre (A, B, C, D…), et à l'intérieur de chaque élément, les objectifs dans leur ordre (X.1 avant X.2…), et à l'intérieur de chaque objectif, le **théorique avant la pratique**. Cette séquence de blocs (chacun un multiple de 2h30, §4.6bis) est ensuite **découpée en séances qui remplissent exactement les créneaux du motif, dans l'ordre chronologique** :

- Si un bloc de contenu est plus court que le créneau disponible, le **bloc suivant de la séquence vient compléter la même séance** — même s'il appartient à un autre objectif ou un autre élément. Une séance peut donc légitimement porter du contenu de deux objectifs différents.
- Si un bloc est plus long que l'espace restant dans le créneau courant, il se **scinde sur le créneau suivant**.
- Aucun créneau ne doit jamais rester partiellement rempli en sortie de cet algorithme.

**Exemple concret, donné par le porteur de projet, à partir de la table de répartition horaire de M202 (A.1 = 5h théorique + 2h30 pratique, A.2 = 2h30 théorique + 2h30 pratique...)** sur un motif mardi/vendredi de 5h chacun à partir du 07/09/2026 :

| Créneau | Contenu correct (rempli intégralement) |
|---|---|
| 07/09, 13h30–18h30 (5h) | A.1 théorique — 5h entières, un seul bloc suffit à remplir le créneau |
| 08/09, 8h30–13h30 (5h) | A.1 pratique (2h30) **+** A.2 théorique (2h30) — deux blocs de deux objectifs différents, combinés pour remplir le créneau |

**Implication d'affichage** : une séance qui combine deux objectifs doit clairement montrer les deux dans son contenu (objectif pédagogique, éléments de contenu couverts) — cohérent avec le fait qu'une séance peut déjà être liée à plusieurs éléments de contenu (§4.2bis), ce n'est pas une exception à gérer à part.

**Prévisions calculées à partir de cette génération** :

- **Par module** : une date de fin prévisionnelle (ex. "M110 se termine le [date]"), déduite de sa masse horaire restante divisée par le rythme hebdomadaire réel qui lui est consacré
- **Par année complète** (1ère ou 2ème) : si tous les modules de l'année sont programmés dans le motif, une date de fin prévisionnelle cumulée pour l'ensemble de l'année

**Positionnement automatique des dates de contrôle** : une fois les séances générées, les dates estimées de CC1, CC2 et EFM local (§4.9 ancien contenu, repris ci-dessous) se calent sur ce calendrier réellement généré, pas sur une simple estimation déconnectée des vraies séances.

**Recalcul automatique obligatoire — bug constaté, ajout v3.** Un bug réel a révélé l'absence de cette règle : le porteur de projet a déclaré un jour férié à une mauvaise date (18/09/2026 au lieu de 18/11/2026), l'a supprimé après coup — et l'app n'a **jamais redéplacé** les séances qui auraient dû se replacer sur la bonne date. Pire, une séance est restée affichée sur un jour ensuite marqué férié (chevauchement visible dans le calendrier), preuve que les séances déjà générées ne sont jamais recalculées après un changement.

**Règle : tout changement qui affecte le placement des séances doit déclencher un recalcul automatique et immédiat des séances non encore réalisées.** Ça inclut :
- Ajout, modification, ou suppression d'un jour non travaillé (férié, vacances, absence — §4.10)
- Modification du motif hebdomadaire actif — **tout changement**, sans exception : ajout ou suppression d'un créneau, changement de groupe sur un créneau existant, et **déplacement d'horaire d'un créneau existant** (ex. un créneau du jeudi qui passe de 8h30-13h30 à 13h30-18h30) — ce dernier cas avait été omis dans une première version de cette règle et constaté cassé en pratique : modifier l'horaire d'un créneau ne déclenchait aucun recalcul, le calendrier restait figé sur l'ancien placement.

**Ce que le recalcul doit produire** :
- Les séances **non encore réalisées** (statut "à faire") sont redéplacées sur les créneaux disponibles, dans le même ordre pédagogique qu'à la génération initiale (§4.9 ci-dessus, remplissage complet des créneaux)
- Les séances déjà marquées **"faite" ne sont jamais déplacées ni modifiées** — elles représentent un fait passé, pas une prévision
- Les **dates de fin prévisionnelles** par module et par année (ci-dessus) sont recalculées en conséquence
- Les dates estimées de CC1/CC2/EFM local se recalent sur le nouveau calendrier

**Retour visuel pendant le recalcul** : l'opération doit être visible pour le formateur — un indicateur (bandeau ou notification) signale qu'un recalcul est en cours, avec une possibilité de l'annuler si le calcul s'exécute en tâche de fond et prend un temps notable. Le formateur ne doit jamais se retrouver avec un calendrier silencieusement obsolète après avoir modifié un jour férié ou un motif.

#### Page dédiée "Emploi du temps"

**Nouvelle page, distincte du calendrier opérationnel (§4.10 ci-dessous)** — c'est le document officiel équivalent à celui du classeur pédagogique papier (section I.B du cahier du formateur : période de validité, horaires, groupes concernés, modules à mettre en œuvre). Contenu :

- Le motif hebdomadaire actif, présenté en grille lisible (jours en colonnes, créneaux en lignes, groupe/module affiché dans chaque case occupée)
- Historique des motifs précédents si plusieurs se sont succédé dans l'année, avec leurs dates de validité respectives
- **Export PDF**, mise en page soignée, dans un format proche du document officiel que l'administration attend — pour impression ou dépôt dans le classeur pédagogique

### 4.10 Calendrier opérationnel (vue semaine)

- Calendrier des jours fériés et vacances OFPPT, préchargé (source à définir — saisie manuelle initiale probable, l'OFPPT ne semble pas exposer d'API)
- Déclaration d'absence (ex. maladie) qui se reflète visuellement dans le calendrier — impacte potentiellement le recalcul de la progression prévue et régénère les projections de fin de module (§4.9 ci-dessus)
- Distinction séances présentiel / à distance visible dans le calendrier

**Grille à 4 créneaux fixes — corrigé v3, remplace la grille grossière Matin/Soir.** La vue calendrier hebdomadaire ne doit plus afficher seulement deux blocs "Matin (8h30-13h30)" et "Soir (13h30-18h30)" de 5h chacun — c'est une grille trop grossière qui ne reflète pas la vraie granularité des créneaux déclarés dans le motif hebdomadaire (§4.9), où un jour peut être scindé en créneaux de 2h30 (ex. le vendredi, DES101 puis DES102). La grille doit reposer sur **4 créneaux fixes de 2h30 chacun**, base commune à toute la semaine :

```
8h30 – 11h00
11h00 – 13h30
13h30 – 16h00
16h00 – 18h30
```

**Une séance plus longue qu'un seul créneau doit visuellement fusionner les lignes qu'elle occupe**, comme un événement de plusieurs heures dans un calendrier classique — une séance de 5h (ex. 8h30-13h30) doit s'afficher comme un seul bloc visuel étiré sur la hauteur des deux créneaux 8h30-11h00 et 11h00-13h30, pas comme deux blocs séparés ni confinée à la hauteur d'un seul créneau. Une séance de 2h30 occupe la hauteur d'un seul créneau.

**Couleur distincte par groupe.** Chaque groupe doit être visuellement identifiable par sa propre couleur dans le calendrier — DDOUX201, DES101, DES102 ne doivent jamais avoir le même traitement visuel, pour qu'on distingue au premier coup d'œil à quel groupe appartient une séance sans avoir à lire le texte. Voir `design_system.md` pour la palette exacte à utiliser (nouvelle palette catégorielle, distincte de la palette de marque/statut).

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
- *Résolu et construit (Phase 5 du backlog) — export PDF fonctionnel depuis l'onglet Fiches d'un groupe, avec sélection de module et de période.*

### 4.13bis Tableau de service — document officiel de masse horaire (corrigé v3, structure réelle confirmée)

**Nouveau document de référence, distinct du classeur pédagogique et de l'emploi du temps.** C'est le document produit par la Direction Régionale, qui liste et fait valider l'ensemble des affectations horaires d'un formateur sur l'année — signé par le formateur, le Directeur Pédagogique et le Directeur Régional.

**Structure réelle du document — corrigée après réception d'un vrai exemplaire.** La première description (une seule colonne "MH AFF" par ligne) était incomplète. Le document officiel réel décompose chaque ligne en **4 valeurs numériques**, croisant deux dimensions qu'on n'avait pas encore modélisées ensemble :

| Colonne officielle | Signification |
|---|---|
| `MHT AFF P S1` | Heures **présentielles**, **semestre 1** |
| `MHT AFF S S1` | Heures **à distance (FAD)**, **semestre 1** |
| `MHT AFF P S2` | Heures **présentielles**, **semestre 2** |
| `MHT AFF S S2` | Heures **à distance (FAD)**, **semestre 2** |

**Colonnes complètes du document** : Code Secteur, Formateur, Spécialité, Niveau de formation, Année scolaire (en-tête) ; puis par ligne : Filière, Groupe, Année de formation, Code module, Intitulé du module, et les 4 colonnes d'heures ci-dessus ; un total par colonne en pied de tableau, et un total général "MHT AFF S1+S2 (P+S)".

**Implication sur le modèle de données — ajout d'une dimension manquante.** La masse horaire allouée à un couple groupe+module ne se décompose pas seulement en présentiel/FAD (§4.1bis) — elle se décompose **aussi par semestre**. Un module peut être dispensé entièrement sur un semestre (ex. dans l'exemple réel, M106 n'a aucune heure en S1, tout est en S2) ou réparti sur les deux (ex. M205 : 55h+15h en S1, 40h+10h en S2). Le modèle doit donc porter, par couple groupe+module : présentiel S1, FAD S1, présentiel S2, FAD S2 — quatre valeurs, pas deux.

**Règle de non-duplication du FAD partagé — confirmée par le document réel.** Sur l'exemple fourni, une séance FAD partagée entre DES101 et DES102 (M104, tronc commun) n'apparaît **que sur la ligne d'un seul des deux groupes** dans le total FAD — pas dupliquée sur les deux. C'est cohérent avec la règle déjà posée en §4.1bis ("175h et non 200h") : le total de masse horaire **affectée au formateur** (ce document) compte les heures réellement dispensées, pas les heures individuellement créditées à chaque groupe pour sa propre progression. **Ces deux totaux ne sont donc pas censés être égaux** : le total de progression par groupe (§4.1bis, chaque groupe crédité de son propre volume) peut légitimement dépasser le total de charge réelle du formateur (ce tableau), précisément à cause des séances FAD partagées.

**Le calcul du total doit toujours passer par les assignations groupe+module, jamais par la durée de référence d'un module seul.** Un module enseigné à deux groupes différents compte deux fois, avec sa masse horaire propre à chaque groupe — pas une seule fois avec sa durée de référence nationale. Toute statistique agrégée affichée dans l'app (comme le total sur la page Modules) doit être calculée en sommant les masses horaires allouées sur toutes les lignes `groupe_modules`, jamais en sommant la durée de référence sur les modules.

**Fonctionnalité produit** : une page qui génère ce tableau automatiquement à partir des assignations réelles `groupe_modules` du formateur, avec les 4 colonnes d'heures correctement calculées (y compris la non-duplication du FAD partagé), export dans un format proche du document officiel (PDF paysage avec cadres de signature) — évite la ressaisie manuelle dans un tableur, comme c'était visiblement le cas jusqu'ici. Les colonnes Mutation (MUT) et EFP restent à saisie manuelle, rien dans le modèle actuel ne les détermine automatiquement — sauf si un champ "Établissement" est ajouté aux paramètres du formateur pour EFP.

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

### 4.15 Gestion multi-année scolaire et duplication (ajout v3)

**Contexte, à comprendre avant le mécanisme.** Le produit n'avait jusqu'ici aucune notion d'année scolaire réelle — tout vivait dans une seule base continue. Or le formateur reconduit d'une année sur l'autre l'essentiel de son organisation (mêmes groupes types, mêmes modules assignés, mêmes contrôles à quelques ajustements près, mêmes fiches de préparation) — **seuls les stagiaires et leurs copies changent réellement**, puisque ce sont de nouvelles personnes chaque année. L'objectif explicite du porteur de projet : ne jamais avoir à regénérer par IA ce qui a déjà été produit l'année précédente, pour ne pas regaspiller du temps ni des appels au modèle.

**Ce qui est propre à chaque année scolaire et démarre vide** (la seule chose remise à zéro) :
- Les stagiaires inscrits
- Leurs copies rendues, notes, présences

**Ce qui est dupliqué comme point de départ réutilisable** (pas régénéré, pas recommencé de zéro) :
- Les groupes (structure, codes) et leurs assignations aux modules — masse horaire allouée, décomposition présentiel/FAD par semestre (§4.1bis, §4.13bis), type d'EFM
- Les séances déjà réparties par le moteur de contenu (§4.2bis) — avec leurs éléments de contenu assignés, mais **sans date** (statut "à planifier", comme une séance nouvellement produite par la répartition horaire) — pas besoin de refaire tourner la répartition, le travail est déjà fait
- Les fiches de préparation de ces séances, comme **brouillon réutilisable** — le contenu généré l'année précédente sert de base, le formateur l'ajuste au lieu de le regénérer intégralement par IA
- Les contrôles, comme **banque de questions réutilisable** — dupliqués en statut brouillon (jamais validé automatiquement), sans date, sans aucune copie de stagiaire rattachée, prêts à être ajustés puis validés pour la nouvelle année

**Ce qui n'est pas dupliqué et doit être redéclaré** :
- Le motif hebdomadaire (§4.9) — le rythme peut changer d'une année à l'autre, et il est de toute façon lié à des dates de validité qui n'ont pas de sens reconduites telles quelles ; une fois le nouveau motif déclaré, il date les séances dupliquées (sans date) de la nouvelle année
- Présences, annonces, devoirs, remarques de séance, dossiers de stage — spécifiques aux stagiaires et aux dates de l'année concernée, jamais transportés d'une année à l'autre

**Implication sur le modèle de données — portée minimale.** Une seule nouvelle table (`annees_scolaires` : libellé, dates de validité) et un seul champ ajouté (`groupes.annee_scolaire_id`) suffisent : tout le reste (séances, contrôles, motifs, présences...) hérite déjà de l'année par sa relation au groupe, pas besoin de dupliquer ce champ partout. Le référentiel (spécialités, programmes, compétences, modules) reste permanent et partagé entre toutes les années, comme aujourd'hui — aucun changement là-dessus.

**Sélecteur d'année scolaire — global.** Un sélecteur en haut de l'application (pas seulement sur certains écrans) change la portée de tout ce qui est affiché — dashboard, groupes, calendrier, contrôles — exactement comme changer de dossier de travail. **Les données d'une année passée ne sont jamais supprimées** en changeant de sélection : elles restent consultables en lecture, intactes, aussi longtemps qu'on ne les efface pas explicitement.

**Le mécanisme de duplication, déclenché par le formateur** — "Créer une nouvelle année à partir de [année précédente]" : crée la nouvelle ligne `annees_scolaires`, duplique les groupes et leurs assignations, les séances sans date avec leur contenu et leur fiche en brouillon, et les contrôles en brouillon — dans cet ordre, puisque chaque étape dépend de la précédente. Le formateur choisit ensuite librement quels groupes dupliquer (il peut ne pas vouloir reconduire un groupe qui n'existera plus, ou en ajouter un nouveau qui n'existait pas avant).

*Point ouvert, à trancher techniquement lors du backlog : faut-il permettre de dupliquer sélectivement (seulement certains groupes, ou seulement certains modules d'un groupe), ou seulement une duplication complète de l'année entière en un geste ? Le porteur de projet n'a pas encore précisé ce niveau de granularité.*

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