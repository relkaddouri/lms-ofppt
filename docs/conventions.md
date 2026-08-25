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