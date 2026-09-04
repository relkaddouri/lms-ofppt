# Conventions techniques

Ce fichier fixe les règles de code que **tout atome doit respecter**, quel que soit le modèle utilisé (local ou cloud). Comme pour `design_system.md`, chaque prompt qui touche au code doit commencer par : *"En respectant strictement docs/conventions.md : [reste du prompt]"*. Sans ce fichier, chaque atome réinvente sa propre façon de faire — c'est la source n°1 d'incohérence et de dette technique observée sur un projet généré en méthode atomique.

## Feedback utilisateur

- **Jamais `alert()` ni `confirm()` natifs.** Toute confirmation d'action passe par une modale ou un état inline explicite ; toute notification de succès/échec passe par un composant toast unique et centralisé (créé une seule fois, réutilisé partout).
- **Toute action qui modifie une donnée confirme visuellement son résultat** — succès ou échec — sans exception, même pour les actions qui semblent mineures.
- **Les suppressions demandent toujours une confirmation explicite**, jamais un clic unique.

## Composants réutilisables

- **Avant de styliser un bouton, un champ, une carte ou une modale, vérifie qu'un composant partagé existe déjà** (`Button`, `Input`, `Card`, `Modal`, `Badge`). S'il n'existe pas encore, crée-le dans `components/` avant de continuer, plutôt que d'écrire une chaîne de classes CSS inline qui sera recopiée dans le prochain atome.
- **Ne jamais dupliquer une fonction utilitaire** (formatage de date, initiales, slug, validation) — vérifie dans `lib/` si elle existe déjà avant d'en écrire une nouvelle version, même légèrement différente.
- **Toute logique répétée dans 2 fichiers ou plus doit être extraite** en fonction, hook ou composant partagé dès qu'elle apparaît une deuxième fois — ne pas attendre une troisième occurrence.

## Structure et architecture

- **Un layout partagé (`layout.tsx`) pour toute section de pages qui répète le même chargement de données ou le même conteneur visuel** — jamais copier-coller le même bloc de récupération de données dans chaque page d'une même section.
- **Une seule source de vérité pour tout mapping** (route → libellé, statut → couleur, rôle → permissions). Si ce mapping doit être utilisé à plusieurs endroits, centralise-le dans un fichier unique et importe-le, ne le réécris jamais localement.
- **Une seule implémentation par fonctionnalité transverse** (export PDF, envoi d'email, appel à un modèle IA) dans un module dédié, importé partout où c'est nécessaire — jamais deux façons différentes de faire la même chose dans deux fichiers.

## Fichiers « use server » — vérifié automatiquement

- **Un module `"use server"` n'exporte que des fonctions `async`.** Une constante, un objet, une fonction synchrone y sont refusés par Next — mais à l'exécution, jamais à la compilation : `tsc --noEmit` reste vert et **l'application entière renvoie 500**, `/login` compris, ce qui envoie chercher la panne au mauvais endroit. Les types (`export type`, `export interface`) sont effacés à la compilation et restent autorisés.
- **Toute valeur ou fonction synchrone partagée entre le serveur et le client va dans `lib/<sujet>.ts`**, jamais dans le fichier d'action — y compris un simple calcul dérivé d'un type, comme le total d'une ligne.
- **Cette règle a échoué quatre fois en s'appuyant sur la mémoire** (`JOURS`, `LOGO_TAILLE_MAX`, `heuresPortees`). Elle est donc vérifiée par un script, pas par la vigilance :

  ```bash
  npm run verifie:actions   # ou npm run verifie, qui enchaîne tsc
  ```

  `scripts/verifie-actions.mjs` parcourt les fichiers dont la première ligne utile est la directive — une action « inline » dans le corps d'une fonction ne compte pas — et sort en erreur au premier export interdit.
- **Le crochet `.githooks/pre-commit` lance ce script à chaque commit.** À activer une fois par clone : `git config core.hooksPath .githooks`.

## Ce qui part au commit — vérifié automatiquement

- **Ne jamais utiliser `git add -A`, ni `git add .`, ni `git commit -a`.** Stager les fichiers un par un : `git add lib/format.ts app/actions/fiches.ts`. Un `add -A` prend tout ce qui traîne dans l'arbre, y compris ce qu'on n'a pas écrit et ce qu'on ne regarde pas.
- **Relire `git diff --staged` avant chaque commit**, sans exception. La liste des fichiers ne suffit pas : les trois incidents de ce projet étaient tous invisibles au niveau du nom de fichier et n'apparaissaient que dans le diff.
- **Trois occurrences, trois formes différentes** :
  1. `app/actions/seance.ts` — un fichier mort remis dans l'arbre par un `add -A`, doublon de sept symboles de `seances.ts`, importé par personne.
  2. `docs/design_system.md` — trois sections (§5.6, §5.7, §5.8) perdues, le fichier ayant été remplacé par une copie plus ancienne. Committé sans que la disparition se voie.
  3. Le même fichier, une seconde fois, deux jours plus tard.
- **Vérifié par un script, pas par la vigilance** — comme la règle `"use server"`, et pour la même raison :

  ```bash
  npm run verifie:stage   # ou npm run verifie, qui enchaîne les deux gardes et tsc
  ```

  `scripts/verifie-stage.mjs` refuse un commit quand : un fichier de code est **ajouté sans qu'aucun autre ne l'importe** ; un document Markdown **perd un titre** présent dans la version committée ; un fichier perd plus de 40 lignes pour moins d'un tiers d'ajouts, ce qui n'est plus une modification mais un remplacement.
- **Le crochet `.githooks/pre-commit` le lance à chaque commit.** Contournement volontaire et explicite : `PEDAGO_STAGE_OK=1 git commit …` — jamais `--no-verify`, qui désactive aussi le garde-fou `"use server"`.

## Sécurité (non négociable, même en phase de prototype)

- **Toute policy RLS Supabase restreint l'accès au propriétaire de la donnée** (`user_id = auth.uid()` ou équivalent) — jamais `using (true)` sur une table contenant des données appartenant à un utilisateur précis, même "temporairement" en phase de test.
- **Toute donnée sensible (note, statut validé, corrigé, information personnelle) n'est jamais accessible en lecture à un rôle anonyme** sans passer par une fonction serveur qui filtre explicitement ce qui est exposé.
- **Aucune écriture de donnée sensible (note, statut, montant) n'est acceptée telle quelle depuis le client.** Elle doit être recalculée ou revalidée côté serveur (server action, RPC `security definer`, ou route API) — ne jamais faire confiance à une valeur envoyée par le navigateur pour ce type de champ.
- **Tout endpoint accessible sans authentification a une limite de débit explicite**, surtout s'il déclenche un appel à une API payante (IA, email, SMS).
- **Aucun secret, clé API ou identifiant ne doit jamais apparaître dans le code** — uniquement en variables d'environnement.

## Validation des entrées

- **Toute donnée reçue par une action serveur ou une route API est validée côté serveur**, indépendamment de toute validation déjà faite côté client — la validation client est une aide à l'utilisateur, jamais une protection.
- **Toute limite (longueur de texte, nombre de lignes importées, taille de fichier) doit être appliquée aussi côté serveur**, pas seulement suggérée dans l'interface.

## Gestion d'erreur

- **Aucune requête ne doit ignorer silencieusement son résultat d'erreur.** Si une requête peut échouer, son erreur est vérifiée et gérée — jamais un `data` utilisé sans avoir regardé le `error` associé.
- **Une erreur technique brute (message Postgres, stack trace) n'est jamais montrée telle quelle à l'utilisateur final** — elle est journalisée côté serveur et remplacée par un message clair côté interface.
- **Un échec partiel (ex. certains emails envoyés, d'autres non) est signalé comme tel**, jamais confondu avec un succès total.

## État et cycle de vie (React)

- **Tout composant qui affiche des données existantes doit les charger explicitement au montage** (`useEffect` ou équivalent) — ne jamais supposer qu'un état initial vide sera rempli automatiquement.
- **Aucune fonction avec effet de bord (soumission, sauvegarde, navigation) n'est appelée depuis l'intérieur d'un updater de `setState`** — elle est déclenchée en dehors, avec la donnée la plus à jour passée explicitement (via `useRef` si nécessaire dans une closure de timer/interval).
- **Tout `setInterval`/`setTimeout` est nettoyé au démontage du composant.**
- **Un `eslint-disable` n'est jamais utilisé pour faire taire un avertissement sans avoir vérifié que le problème signalé n'est pas réel** — c'est souvent le lint qui a raison.

## Performance

- **Toute librairie lourde utilisée dans un seul flux ponctuel (export PDF, graphique, éditeur riche) est chargée en import dynamique**, jamais en import statique en haut de fichier, pour ne pas alourdir le chargement initial des pages qui ne l'utilisent pas immédiatement.
- **Toute requête à la base ne sélectionne que les colonnes réellement utilisées** (`select("id, nom")`), jamais `select("*")` par réflexe.
- **Aucune boucle ne doit contenir un appel réseau ou base de données individuel** quand une requête groupée (`.in()`, jointure, ou traitement en lot d'une API tierce) est possible.

## Revue périodique

- **Tous les 8 à 10 atomes, relis l'ensemble du code produit** (ou fais-le auditer) plutôt que d'attendre la fin du projet — les incohérences entre atomes s'accumulent silencieusement et sont bien moins coûteuses à corriger tôt.