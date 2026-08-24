# Construire ton LMS OFPPT — OpenCode + Qwen2.5-Coder + Next.js + Supabase

Ce tuto t'emmène du poste vide jusqu'à une application fonctionnelle, en utilisant une approche **Workflow Atomique** : au lieu de demander à l'IA de "faire toute l'appli", tu découpes le projet en petites tâches indépendantes, testables une par une. C'est indispensable avec un modèle local comme qwen2.5-coder:7b, qui est bon mais moins puissant qu'un modèle cloud (et un cran en dessous du 14B) — il travaille mieux sur des tâches courtes et précises que sur des demandes vagues et larges. Avec le 7B, sois encore plus strict sur la granularité : si un atome du backlog te semble encore trop large une fois testé, découpe-le en deux avant de continuer.

---

## Partie 0 — Le principe du Workflow Atomique

Un "atome" = une tâche unique, avec :
- **Un objectif clair** ("créer la table Supabase `groupes`", pas "gérer les groupes")
- **Un périmètre limité** (1 à 3 fichiers max)
- **Un critère de test** (comment tu vérifies que ça marche avant de passer à l'atome suivant)

La règle d'or : si tu ne peux pas décrire la tâche en une phrase courte et vérifier le résultat en 2 minutes, découpe-la encore.

Exemple de mauvais atome : *"Crée le module de suivi de progression."*
Exemple de bon atome : *"Crée une table Supabase `seances` (id, groupe_id, module_id, date, contenu_prevu, contenu_realise, statut) et une fonction TypeScript `getSeancesByGroupe(groupeId)` qui la lit."*

Tu vas construire tout le projet comme une liste d'atomes, dans l'ordre. C'est aussi ce qui te permettra de reprendre le projet plus tard sans tout reperdre en tête.

---

## Partie 1 — Installer l'environnement local

### 1.1 Installer Ollama (le moteur qui fait tourner le modèle)

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama --version
```

### 1.2 Télécharger ton modèle

```bash
ollama pull qwen2.5-coder:7b-instruct-q4_K_M
```

C'est un modèle d'environ 4,5-5 Go — nettement plus léger que le 14B, donc plus de marge sur ta VRAM/RAM et moins de risque de te retrouver bloqué par tes autres applications ouvertes.

### 1.3 Le point critique : la fenêtre de contexte

Par défaut, Ollama limite le contexte à 4096 tokens. C'est beaucoup trop court pour un usage "agent" (lecture de fichiers, édition de code) : au-delà de cette limite, les outils d'OpenCode échouent silencieusement — tu verras des comportements bizarres sans message d'erreur clair. Il faut créer une variante avec un contexte plus large :

```bash
ollama run qwen2.5-coder:7b-instruct-q4_K_M
>>> /set parameter num_ctx 16384
>>> /save qwen2.5-coder-7b-16k
>>> /bye
```

Tu utiliseras désormais `qwen2.5-coder-7b-16k` comme nom de modèle dans ta config OpenCode. On reste sur 16k plutôt que 32k ici : le 7B a de toute façon moins besoin d'un contexte immense vu qu'on le nourrit d'atomes courts, et ça laisse encore plus de marge mémoire.

### 1.4 Installer OpenCode

```bash
curl -fsSL https://opencode.ai/install | sh
```

### 1.5 Connecter OpenCode à Ollama

Édite (ou crée) `~/.config/opencode/opencode.json` :

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama",
      "options": { "baseURL": "http://localhost:11434/v1" },
      "models": {
        "qwen2.5-coder-7b-16k": { "name": "qwen2.5-coder-7b-16k" }
      }
    }
  }
}
```

### 1.6 Tester

```bash
opencode
```

Dans l'interface, choisis le provider `ollama`, puis le modèle `qwen2.5-coder-7b-16k`. Pose une question simple ("écris une fonction debounce en TypeScript") pour confirmer que tout communique bien avant de commencer le vrai projet.

### 1.7 Utiliser OpenCode directement dans VS Code

Tu n'es pas obligé de jongler entre un terminal externe et VS Code : OpenCode s'intègre nativement dans le terminal intégré de VS Code, et le code que tu vois dans l'éditeur reste toujours synchronisé avec ce sur quoi OpenCode travaille.

**Installation de l'extension** — deux méthodes :

1. **Automatique (la plus simple)** : ouvre VS Code sur le dossier de ton projet, ouvre le terminal intégré (`` Ctrl+` ``), et tape simplement `opencode`. VS Code détecte qu'il tourne dans son propre terminal intégré et installe l'extension officielle automatiquement au premier lancement.
2. **Manuelle** : cherche `opencode` dans le Marketplace VS Code (`Ctrl+Shift+X`, publié par `sst-dev`) et installe-la toi-même si l'installation automatique ne se déclenche pas.

Si l'installation automatique échoue, vérifie que la commande `code` est bien accessible depuis un terminal : `Ctrl+Shift+P` → tape "Shell Command: Install 'code' command in PATH" → valide.

**Raccourcis utiles une fois installé :**

| Raccourci (Windows/Linux) | Action |
|---|---|
| `Ctrl+Echap` | Ouvre OpenCode dans un panneau de terminal scindé (ou remet le focus dessus s'il tourne déjà) |
| `Ctrl+Maj+Echap` | Démarre une nouvelle session OpenCode, même si une autre est déjà ouverte |
| `Alt+Ctrl+K` | Insère une référence au fichier ou à la sélection active dans ton prompt (ex. `@src/app/page.tsx#L12-40`) — pratique pour donner un atome précis sans taper le chemin à la main |

**Pourquoi c'est pertinent pour ton workflow atomique** : le raccourci de référence de fichier (`Alt+Ctrl+K`) t'aide justement à rester précis dans tes atomes — plutôt que d'écrire "modifie la page de progression", tu sélectionnes le bloc de code concerné dans l'éditeur, tu appuies sur le raccourci, et OpenCode reçoit une référence exacte au fichier et aux lignes. C'est encore plus important avec un modèle 7B, qui a moins de marge que le 14B pour deviner ce que tu attends s'il n'a que du texte vague.

Un point à savoir : l'extension VS Code est une simple interface — tout passe par le binaire `opencode` installé sur ta machine (partie 1.4). Ta config `~/.config/opencode/opencode.json` (partie 1.5) s'applique donc de la même façon, que tu lances OpenCode depuis un terminal externe ou depuis VS Code.

---

## Partie 2 — Cadrer le projet avant de coder

Avant d'ouvrir OpenCode sur le vrai projet, définis ton périmètre sur papier (ou dans un fichier `SPEC.md` à la racine du repo — c'est même un excellent premier atome). Pour ton LMS OFPPT, les entités principales sont :

- **Modules** — les modules de formation que tu enseignes
- **Groupes** — les groupes de stagiaires (une session)
- **Stagiaires** — rattachés à un groupe
- **Fiches de préparation** — un document généré par module, servant de support pédagogique
- **Séances / Progression** — le suivi séance par séance, par groupe, de ce qui a été vu
- **Contrôles** — les évaluations générées avec l'aide de l'IA, liées à un module et une échéance (30h)
- **Annonces / Partage d'infos** — ce que tu communiques aux stagiaires

Résiste à la tentation de tout construire d'un coup. Le MVP raisonnable, dans l'ordre de priorité :
1. Authentification formateur + structure Modules/Groupes/Stagiaires
2. Suivi de progression par groupe
3. Génération de fiches de préparation assistée par IA
4. Partage d'infos avec les stagiaires
5. Génération de contrôles assistée par IA

---

## Partie 3 — Setup technique du projet

### 3.1 Créer le projet Next.js

```bash
npx create-next-app@latest lms-ofppt --typescript --tailwind --app
cd lms-ofppt
```

### 3.2 Créer le projet Supabase

Sur [supabase.com](https://supabase.com), crée un nouveau projet. Récupère `Project URL` et `anon key` dans Settings → API.

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Crée `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=ton_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=ta_cle
```

### 3.3 Schéma de base de données (premier vrai atome pour OpenCode)

C'est ici que tu commences à travailler avec OpenCode plutôt qu'à la main, pour t'entraîner tout de suite au workflow atomique. Ouvre `opencode` dans le dossier du projet et donne-lui **un atome à la fois** :

**Atome 1** — *"Écris le SQL Supabase pour créer les tables `modules`, `groupes`, `stagiaires` avec les relations suivantes : un groupe suit plusieurs modules, un stagiaire appartient à un groupe. Inclus les policies RLS de base (lecture pour utilisateurs authentifiés)."*

Vérifie le SQL généré à la main avant de l'exécuter dans l'éditeur SQL de Supabase — ne fais jamais confiance aveuglément à un modèle 7B sur du SQL avec des contraintes de clés étrangères, relis toujours.

**Atome 2** — *"Ajoute les tables `seances` (progression par groupe/module) et `fiches_preparation`."*

**Atome 3** — *"Ajoute les tables `controles` et `questions_controle`."*

Fais un atome, teste-le dans Supabase, passe au suivant. Ne demande jamais tout le schéma en un seul prompt : c'est exactement le genre de tâche large où un 7B local part vite en erreurs de syntaxe ou en incohérences entre tables — encore plus qu'avec un 14B.

### 3.4 Authentification

**Atome** — *"Configure Supabase Auth (email/password) dans ce projet Next.js App Router : client Supabase côté serveur et côté client, middleware de session, page de login."* Teste en te connectant avec un compte test avant de continuer.

---

## Partie 4 — Le Workflow Atomique en pratique, module par module

Pour chaque fonctionnalité, garde ce triptyque :
1. **Donnée** — la table / le modèle existe déjà (partie 3)
2. **API** — une route ou une server action qui lit/écrit cette donnée
3. **UI** — un composant qui appelle cette route

Ne demande jamais les trois d'un coup à qwen2.5-coder:7b. Trois atomes séparés, trois vérifications séparées — et si un atome échoue, découpe-le encore avant de réessayer plutôt que de reformuler en plus vague.

Exemple pour le suivi de progression :

- Atome A : *"Server action `updateSeance(id, contenu_realise, statut)` qui met à jour une séance dans Supabase."*
- Atome B : *"Composant React `SeanceCard` qui affiche une séance et permet de la marquer comme faite."*
- Atome C : *"Page `/groupes/[id]/progression` qui liste les séances du groupe avec `SeanceCard`."*

Après chaque atome : `npm run dev`, tu regardes dans le navigateur, tu commits (`git commit`) si ça marche. C'est ce commit régulier qui te permet de revenir en arrière si un atome suivant casse quelque chose — essentiel quand le modèle local se trompe.

---

## Partie 5 — Génération IA des fiches de préparation

Ici, tu ne demandes pas à OpenCode d'écrire du code une fois pour toutes : tu construis une **fonctionnalité de ton appli** qui elle-même appelle un modèle IA à chaque utilisation. Deux choix possibles :

- **Rester 100% local** : ta route Next.js appelle l'API Ollama (`http://localhost:11434/v1`) avec qwen2.5-coder ou, mieux pour du texte pédagogique, un modèle généraliste comme `qwen2.5:7b-instruct` (le "coder" est optimisé code, pas rédaction). Vu la taille réduite du 7B, la qualité rédactionnelle en français restera limitée — pèse sérieusement l'option API cloud pour cette partie précise, même à petit budget.
- **Passer par une API cloud** (Anthropic, OpenAI) pour une meilleure qualité rédactionnelle, si tu as un budget, même faible — la génération de fiches n'a lieu qu'une fois par module, donc le coût reste marginal.

Atomes à donner à OpenCode :

- *"Crée une route API `/api/generate/fiche-preparation` qui prend `module_id` en entrée, récupère les infos du module dans Supabase, construit un prompt structuré (objectifs, prérequis, déroulé, activités, évaluation) et appelle [Ollama en local / l'API choisie], puis retourne le texte généré."*
- *"Crée un composant `FichePreparationForm` qui appelle cette route et affiche le résultat dans un éditeur modifiable avant sauvegarde dans `fiches_preparation`."*

Le point important : le prompt que tu envoies au modèle doit être **structuré et spécifique à ton référentiel OFPPT** (compétences visées, découpage horaire, méthode pédagogique). Écris ce prompt toi-même avec soin — c'est la partie qui déterminera la qualité, pas le code autour.

---

## Partie 6 — Suivi de progression par groupe

Reprend le triptyque Donnée / API / UI de la partie 4. Pense à une vue tableau de bord : liste des groupes → pourcentage d'avancement par module → détail séance par séance. Un bon atome final ici : *"Crée une vue `/dashboard` qui agrège, pour chaque groupe, le pourcentage de séances marquées 'réalisé' par module."*

---

## Partie 7 — Partager des infos avec les stagiaires

Options selon ton besoin réel :
1. **Portail lecture seule** : les stagiaires ont un compte Supabase (rôle `stagiaire`) et voient uniquement leur groupe — nécessite des policies RLS précises.
2. **Sans compte stagiaire** : tu génères un lien public en lecture seule par groupe (plus simple à mettre en place, moins de gestion de comptes).

Pour démarrer vite, l'option 2 est plus atomique et plus rapide à livrer. Atome : *"Crée une page publique `/public/groupe/[token]` qui affiche les annonces et la progression d'un groupe à partir d'un token unique stocké dans la table `groupes`, sans authentification."*

---

## Partie 8 — Génération de contrôles avec l'IA (contrainte des 30h)

Même logique que les fiches de préparation : une route qui construit un prompt à partir du contenu réellement couvert (tu peux réutiliser les `seances` marquées "réalisé" comme base, pour que le contrôle porte sur ce qui a vraiment été enseigné).

Atomes :
- *"Crée une route `/api/generate/controle` qui prend `module_id` et `duree_heures`, récupère les séances réalisées, et génère un contrôle structuré (consignes, questions, barème, corrigé) via le modèle IA."*
- *"Stocke le résultat dans `controles` et `questions_controle`, avec un statut brouillon/validé."*
- *"Crée une page d'édition qui te permet de relire, corriger et valider le contrôle avant impression/export."*

Point de vigilance pédagogique : **relis systématiquement les contrôles générés avant de les distribuer.** Un modèle 7B peut produire des questions ambiguës, un barème qui ne tombe pas juste sur 20, ou un corrigé légèrement faux — encore plus qu'un 14B, donc redouble de vigilance ici. Le gain de temps est réel, mais la validation humaine reste obligatoire.

---

## Partie 9 — Déploiement

Une fois le MVP stable en local :

```bash
npm install -g vercel
vercel
```

Renseigne les mêmes variables d'environnement Supabase dans le dashboard Vercel. Ta base Supabase reste hébergée chez Supabase (pas besoin de la redéployer).

---

## Partie 10 — Backlog atomique complet, étape par étape (avec interfaces)

Voici la liste exhaustive de tous les atomes du projet, dans l'ordre exact où les donner à OpenCode — y compris la création de chaque interface (page, composant, formulaire). Coche au fur et à mesure (`- [ ]` → `- [x]`), commit après chaque atome validé, et ne passe jamais au suivant tant que le précédent n'est pas testé.

Chaque atome suit le même format : le **prompt exact** à donner à OpenCode, et le **test** qui te dit que tu peux passer à la suite.

### Phase 0 — Squelette du projet

- [ ] **0.1** — Terminal, hors OpenCode : `npx create-next-app@latest lms-ofppt --typescript --tailwind --app`, puis `cd lms-ofppt`
  **Test** : `npm run dev` affiche la page d'accueil par défaut de Next.js sur `localhost:3000`.
- [ ] **0.2** — Terminal : `npm install @supabase/supabase-js @supabase/ssr`, crée le projet sur supabase.com, remplis `.env.local` avec `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  **Test** : les deux variables sont bien dans `.env.local` (fichier ignoré par Git).
- [ ] **0.3** — Prompt OpenCode : *"Crée `lib/supabase/client.ts` (client Supabase navigateur) et `lib/supabase/server.ts` (client Supabase serveur pour App Router), en te basant sur `@supabase/ssr`."*
  **Test** : les deux fichiers existent, aucune erreur TypeScript à la compilation (`npm run build`).

### Phase 1 — Schéma de base de données

- [ ] **1.1** — Prompt : *"Écris le SQL pour créer les tables `modules` (id, nom, description, duree_heures) et `groupes` (id, nom, date_debut, date_fin), sans relation pour l'instant. Écris ce SQL dans un fichier `supabase/migrations/001_modules_groupes.sql`."*
  **Test** : relis le fichier généré, colle son contenu dans l'éditeur SQL Supabase, exécute, vérifie que les deux tables apparaissent dans Table Editor.
- [ ] **1.2** — Prompt : *"Crée `supabase/migrations/002_stagiaires.sql` : table `stagiaires` (id, nom, prenom, email, groupe_id en clé étrangère vers `groupes`)."*
  **Test** : la table apparaît, la contrainte de clé étrangère est visible dans Supabase (colonne `groupe_id` liée).
- [ ] **1.3** — Prompt : *"Crée `supabase/migrations/003_groupe_modules.sql` : table de liaison `groupe_modules` (groupe_id, module_id) pour la relation plusieurs-à-plusieurs entre groupes et modules."*
  **Test** : insère une ligne test à la main dans Supabase pour vérifier que les deux clés étrangères fonctionnent.
- [ ] **1.4** — Prompt : *"Crée `supabase/migrations/004_seances.sql` : table `seances` (id, groupe_id, module_id, date, contenu_prevu, contenu_realise, statut par défaut 'a_faire')."*
  **Test** : table visible, `statut` accepte bien la valeur par défaut sur une ligne insérée sans la préciser.
- [ ] **1.5** — Prompt : *"Crée `supabase/migrations/005_fiches_controles.sql` : tables `fiches_preparation` (id, module_id, contenu, statut) et `controles` (id, module_id, titre, statut) + `questions_controle` (id, controle_id, enonce, bareme, corrige)."*
  **Test** : les quatre tables sont visibles, `questions_controle.controle_id` pointe bien vers `controles.id`.
- [ ] **1.6** — Prompt : *"Ajoute les policies RLS de base sur toutes les tables : lecture et écriture réservées aux utilisateurs authentifiés."*
  **Test** : active RLS dans Supabase (Table Editor → chaque table → RLS activé), vérifie qu'une requête sans authentification échoue bien.

### Phase 2 — Authentification et interface de connexion

- [ ] **2.1** — Prompt : *"Configure Supabase Auth email/password dans ce projet : middleware Next.js qui rafraîchit la session, et helper `getUser()` côté serveur."*
  **Test** : `npm run build` sans erreur, le middleware est présent dans `middleware.ts` à la racine.
- [ ] **2.2 — Interface** — Prompt : *"Crée la page `/login` : formulaire email + mot de passe, bouton de connexion, message d'erreur si échec, redirection vers `/dashboard` si succès."*
  **Test** : crée un compte formateur test dans Supabase Auth, connecte-toi via `/login` dans le navigateur.
- [ ] **2.3 — Interface** — Prompt : *"Crée un composant `Header` avec le nom du formateur connecté et un bouton de déconnexion, à afficher sur toutes les pages protégées via `app/(protected)/layout.tsx`."*
  **Test** : le header apparaît sur les pages protégées, le bouton déconnecte bien et renvoie vers `/login`.

### Phase 3 — Gestion des Modules (Donnée → API → Interface)

- [ ] **3.1** — Prompt : *"Server actions `createModule`, `updateModule`, `deleteModule`, `getModules` dans `app/actions/modules.ts`."*
  **Test** : teste `getModules` depuis une page temporaire, vérifie que la liste (vide au départ) s'affiche sans erreur.
- [ ] **3.2 — Interface** — Prompt : *"Crée la page `/modules` : tableau listant tous les modules (nom, durée), avec un bouton 'Ajouter un module' qui ouvre un formulaire (modal ou page dédiée) utilisant `createModule`."*
  **Test** : ajoute un module de test via l'interface, il apparaît dans le tableau sans recharger la page.
- [ ] **3.3 — Interface** — Prompt : *"Ajoute à la page `/modules` un bouton Modifier et un bouton Supprimer par ligne, reliés à `updateModule` et `deleteModule`, avec une confirmation avant suppression."*
  **Test** : modifie un module test, supprime-le, vérifie que la liste se met à jour à chaque fois.

### Phase 4 — Gestion des Groupes et Stagiaires (Donnée → API → Interface)

- [ ] **4.1** — Prompt : *"Server actions `createGroupe`, `getGroupes`, `assignModulesToGroupe` dans `app/actions/groupes.ts`."*
  **Test** : appel manuel de `getGroupes` sans erreur.
- [ ] **4.2 — Interface** — Prompt : *"Crée la page `/groupes` : liste des groupes avec dates et nombre de stagiaires, bouton 'Créer un groupe' avec formulaire (nom, dates, sélection multiple des modules suivis)."*
  **Test** : crée un groupe test avec 2 modules assignés, vérifie l'affichage.
- [ ] **4.3** — Prompt : *"Server actions `addStagiaire`, `getStagiairesByGroupe`, `removeStagiaire` dans `app/actions/stagiaires.ts`."*
  **Test** : appel manuel, pas d'erreur.
- [ ] **4.4 — Interface** — Prompt : *"Crée la page `/groupes/[id]` : détail d'un groupe, liste des stagiaires avec formulaire d'ajout rapide (nom, prénom, email) et bouton de suppression par ligne."*
  **Test** : ajoute 2-3 stagiaires test à un groupe, vérifie qu'ils apparaissent et peuvent être supprimés.

### Phase 5 — Suivi de progression (Donnée → API → Interface)

- [ ] **5.1** — Prompt : *"Server action `createSeancesForGroupe(groupeId)` qui génère automatiquement les lignes `seances` pour chaque module assigné au groupe, et `updateSeance(id, contenu_realise, statut)` pour les mettre à jour."*
  **Test** : appelle la fonction sur ton groupe test, vérifie dans Supabase que les séances sont créées.
- [ ] **5.2 — Interface** — Prompt : *"Crée le composant `SeanceCard` : affiche la date, le contenu prévu, un champ texte pour le contenu réalisé, et un bouton pour marquer la séance comme faite (appel à `updateSeance`)."*
  **Test** : composant isolé, teste-le avec des props de démonstration sur une page temporaire.
- [ ] **5.3 — Interface** — Prompt : *"Crée la page `/groupes/[id]/progression` : liste toutes les séances du groupe avec `SeanceCard`, groupées par module."*
  **Test** : marque une séance comme faite depuis l'interface, vérifie que le statut se met à jour dans Supabase sans recharger la page.

### Phase 6 — Dashboard formateur (Interface d'agrégation)

- [ ] **6.1** — Prompt : *"Server action `getProgressionSummary()` qui calcule, pour chaque groupe, le pourcentage de séances au statut 'fait' par module."*
  **Test** : appel manuel, vérifie que le calcul est correct sur ton groupe test.
- [ ] **6.2 — Interface** — Prompt : *"Crée la page `/dashboard` : une carte par groupe, avec une barre de progression par module basée sur `getProgressionSummary`, et un lien vers `/groupes/[id]/progression`."*
  **Test** : le pourcentage affiché correspond à ce que tu as coché en phase 5.

### Phase 7 — Génération IA des fiches de préparation (Donnée → API IA → Interface)

- [ ] **7.1** — Prompt : *"Crée `/api/generate/fiche-preparation/route.ts` : reçoit `module_id`, récupère les infos du module, construit un prompt structuré (objectifs, prérequis, déroulé horaire, activités, évaluation) et appelle le modèle IA configuré (Ollama local ou API cloud), retourne le texte généré en JSON."*
  **Test** : teste la route avec un outil comme Postman/Insomnia ou `curl`, vérifie que le texte revient correctement structuré.
- [ ] **7.2 — Interface** — Prompt : *"Crée la page `/modules/[id]/fiche-preparation` : bouton 'Générer avec l'IA' qui appelle la route, affiche le résultat dans un éditeur de texte modifiable, bouton 'Enregistrer' qui sauvegarde dans `fiches_preparation`."*
  **Test** : génère une fiche pour un module test, modifie le texte, enregistre, recharge la page et vérifie que la version modifiée est bien celle affichée.

### Phase 8 — Partage d'informations avec les stagiaires (Interface publique)

- [ ] **8.1** — Prompt : *"Ajoute une colonne `token_public` (uuid généré automatiquement) à la table `groupes`. Server action `getGroupePublicData(token)` qui retourne les infos du groupe et sa progression, sans authentification requise."*
  **Test** : vérifie dans Supabase que chaque groupe a bien un token unique généré.
- [ ] **8.2 — Interface** — Prompt : *"Crée la page publique `app/public/groupe/[token]/page.tsx` : affiche le nom du groupe, la progression par module (lecture seule, sans bouton de modification), sans nécessiter de connexion."*
  **Test** : ouvre l'URL en navigation privée (donc non connecté) et vérifie que la page s'affiche correctement.
- [ ] **8.3 — Interface** — Prompt : *"Sur la page `/groupes/[id]`, ajoute un bouton 'Copier le lien de partage' qui copie l'URL publique du groupe dans le presse-papiers."*
  **Test** : clique sur le bouton, colle le lien dans un nouvel onglet, vérifie qu'il ouvre la bonne page publique.

### Phase 9 — Génération IA des contrôles (Donnée → API IA → Interface)

- [ ] **9.1** — Prompt : *"Crée `/api/generate/controle/route.ts` : reçoit `module_id` et `duree_heures`, récupère les séances au statut 'fait' du module, construit un prompt (consignes, questions, barème sur 20, corrigé) et appelle le modèle IA, retourne un contrôle structuré en JSON."*
  **Test** : teste la route isolément, vérifie que le barème total tombe bien sur 20 (relis à la main, ne fais pas confiance au modèle sur ce calcul).
- [ ] **9.2** — Prompt : *"Server action `saveControle(moduleId, data)` qui enregistre le résultat dans `controles` et `questions_controle`, statut 'brouillon' par défaut."*
  **Test** : vérifie dans Supabase que les questions sont bien liées au bon contrôle.
- [ ] **9.3 — Interface** — Prompt : *"Crée la page `/modules/[id]/controle` : bouton 'Générer un contrôle', affichage des questions générées dans une liste éditable (modifier énoncé/barème/corrigé), bouton 'Valider' qui change le statut à 'validé'."*
  **Test** : génère un contrôle test, corrige volontairement une question, valide, vérifie que le statut passe bien à 'validé' dans Supabase.
- [ ] **9.4 — Interface** — Prompt : *"Ajoute un bouton 'Exporter en PDF' sur la page du contrôle validé, qui génère un PDF propre (titre, consignes, questions numérotées, barème) prêt à imprimer."*
  **Test** : exporte un contrôle test, ouvre le PDF, vérifie la mise en page.

### Phase 10 — Déploiement

- [ ] **10.1** — Terminal : `npm install -g vercel` puis `vercel`.
  **Test** : le déploiement se termine sans erreur, l'URL Vercel s'ouvre.
- [ ] **10.2** — Ajoute `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les variables d'environnement du projet sur le dashboard Vercel.
  **Test** : reconnecte-toi via `/login` sur l'URL Vercel (pas juste en local), vérifie que le dashboard charge bien tes données réelles.

---

Garde ce fichier ouvert pendant que tu avances, et coche chaque case au fur et à mesure — c'est ton backlog atomique complet, de l'installation jusqu'au déploiement.