# Audit de consommation CPU — Vercel (plan Hobby)

**Date** : 26 septembre 2026 · **Contexte** : 75 % du quota « Fluid Active CPU » (4 h/mois) consommés, pour 1 formateur et ~60 stagiaires.
**Méthode** : lecture du code uniquement, aucun fichier modifié. Les chiffres sont des estimations à confirmer dans le tableau de bord Vercel (voir § 5).

---

## 0. Ce qu'on paie, au juste

Vercel ne facture pas le **temps** d'une requête, il facture le **CPU actif** : les millisecondes pendant lesquelles le processeur travaille vraiment.

- Attendre une réponse de Supabase ou de DeepSeek : **presque gratuit** (le processeur dort).
- Lire, analyser et transformer les données reçues : **payant**. `JSON.parse` de 500 Ko, c'est du calcul.
- Fabriquer le HTML d'une page (React côté serveur) : **payant**.
- Démarrer la fonction, vérifier un jeton, ouvrir un client Supabase : **payant**, à chaque requête.

D'où la règle qui gouverne tout ce rapport : **ce qui coûte, ce n'est pas la lenteur, c'est le nombre de requêtes serveur × la quantité de données brassées à chaque fois.**

---

## 1. Cartographie de ce qui tourne côté serveur

| Élément | Où | Combien | Déclenché par |
|---|---|---|---|
| **Proxy** (ex-middleware) | `proxy.ts` | 1 | Chaque requête sauf fichiers statiques et images |
| **Layout formateur** | `app/(protected)/layout.tsx` | 1 | Chaque page de l'espace formateur |
| **Layout stagiaire** | `app/espace-stagiaire/layout.tsx` | 1 | Chaque page de l'espace stagiaire |
| **Server Components** (pages) | ~50 pages | 50 | Chaque affichage, tout est dynamique |
| **Server Actions** | `app/actions/*.ts` | 43 fichiers, 183 fonctions | Formulaires, boutons, et **appels automatiques au montage** |
| **Route handlers** | `app/api/**/route.ts` | 12 | Génération IA (11) + confirmation de lien (1) |
| **Appels IA** | DeepSeek via `lib/llm.ts` | — | Sujets, supports, fiches, quiz, corrections, analyses |
| **Envoi d'emails** | Resend, `lib/courriel.ts` | — | Invitations (rare, `maxDuration = 60`) |
| **Génération PDF** | `lib/pdf-*.ts` | 20 fichiers | **Côté navigateur** (imports dynamiques dans des composants client) — aucun coût serveur ✅ |
| **Crons** | aucun (`vercel.json` absent) | 0 | — ✅ |
| **Rendu statique / ISR** | aucun | 0 | Tout est rendu à la demande |

**Volume de données** : 33 supports de cours, **24 Ko en moyenne** de JSON chacun, jusqu'à 49 Ko.

---

## 2. Les problèmes trouvés

| # | Fichier | Problème | Impact | Effort |
|---|---|---|---|---|
| 1 | `components/Cloche.tsx` (`RYTHME = 45_000`) | Sondage serveur toutes les 45 s, pour **chaque** utilisateur connecté | **Fort** | Facile |
| 2 | `app/actions/notifications.ts` | La cloche du formateur lit 8 tables, dont les **copies entières** (`responses`) de 40 passations, et une requête **sans limite** | **Fort** | Facile |
| 3 | `app/actions/cours-stagiaire.ts` (`lireSupports`) | Chaque page de cours télécharge le **contenu de tous les supports** du groupe (~800 Ko), parfois **deux fois** sur la même page | **Fort** | Moyen |
| 4 | `app/(protected)/layout.tsx` | Chaque page formateur relance `getNotifications()` (les 8 mêmes requêtes) en plus du reste | **Fort** | Facile |
| 5 | `lib/supabase/server.ts` (`getCurrentUserRole`) | Le crochet de jeton n'étant pas activé, une lecture de `profils` s'ajoute à **chaque** page formateur (atome 6.2 jamais terminé) | **Moyen** | Facile (2 clics Supabase) |
| 6 | `proxy.ts` | S'exécute aussi sur `/api/**` (double vérification du jeton) et sur les **polices `.ttf`**, absentes du matcher | **Moyen** | Facile |
| 7 | `components/ModaleDistinction.tsx` | Appel serveur au montage du layout stagiaire, pour une fête qui concerne un stagiaire sur soixante | **Moyen** | Facile |
| 8 | `components/DocumentRedige.tsx` | Le markdown d'un cours (24 Ko) est analysé et rendu **côté serveur à chaque ouverture**, alors qu'il ne change presque jamais | **Moyen** | Moyen |
| 9 | Aucun `app/robots.ts` | Les robots d'indexation font tourner le proxy et la page de connexion | **Faible** | Facile |
| 10 | Aucune mise en cache (`revalidate`, `unstable_cache`) | Tout est recalculé à chaque affichage, même ce qui ne bouge pas de la semaine | **Moyen** | Moyen |

---

### Problème 1 — La cloche sonne toutes les 45 secondes (impact **fort**, effort **facile**)

> **Rectification du 26/09/2026** : en corrigeant, j'ai découvert que la pause quand l'onglet est caché **existait déjà** (`if (document.visibilityState !== "visible") return;`). Mon rapport initial la présentait comme manquante. Le gain vient donc uniquement du rythme, et il reste le plus important du lot.

**Le code** : `components/Cloche.tsx` ligne 237, `const RYTHME = 45_000`, puis `setInterval(verifier, RYTHME)`. Cette cloche est montée dans **les deux espaces** : `components/Topbar.tsx` pour vous, `app/espace-stagiaire/layout.tsx` pour les stagiaires. Elle est donc présente sur **toutes les pages**.

**Pourquoi ça consomme.** Chaque tic appelle une Server Action : une requête HTTP vers Vercel, qui démarre une fonction, ouvre un client Supabase, vérifie le jeton, lit plusieurs tables, assemble une liste et la renvoie. Le processeur travaille vraiment à chaque fois — et il recommence 80 fois par heure et par personne.

**L'ordre de grandeur.** Une séance de 5 h avec 15 stagiaires :

> 15 stagiaires × 80 tics/heure × 5 heures = **6 000 appels serveur** pour la seule cloche.

Sur un mois de cours (≈ 20 journées), on arrive à **plus de 100 000 appels**. À 100 ms de CPU actif chacun — une estimation basse —, cela fait **presque 3 heures de CPU actif**, sur un quota de 4 h. **À elle seule, la cloche explique votre alerte.**

Et le pire : la plupart de ces appels ne rapportent rien. Un stagiaire qui lit un chapitre pendant une heure déclenche 80 vérifications pour, au mieux, une annonce.

---

### Problème 2 — La cloche du formateur transporte les copies entières (impact **fort**, effort **facile**)

**Le code** : `app/actions/notifications.ts`, `getNotifications()`. Huit requêtes, dont :

```
.from("passations_controle")
.select("id, nom_complet, note, responses, submitted_at, controle_id")   ← `responses` = la copie entière
.limit(40)
```

et

```
.from("reponses_question")
.select("id, question_id, texte, created_at, statut, questions_support(...)")
.order("created_at", { ascending: false })                                ← aucune limite
```

**Pourquoi ça consomme.** `responses`, c'est le JSON de toute la copie d'un stagiaire : ses réponses, le corrigé, les commentaires — plusieurs kilo-octets par copie. En demander 40 revient à faire transiter, puis analyser, **plusieurs centaines de kilo-octets** — pour n'afficher qu'un nombre dans une pastille. Et `JSON.parse` de 500 Ko, c'est exactement le genre de calcul que Vercel facture.

La requête sans limite, elle, grossira toute seule : aujourd'hui quelques dizaines de lignes, dans un an plusieurs milliers.

**Le cumul avec le problème 1** : cette fonction tourne toutes les 45 secondes **et** à chaque chargement de page formateur (problème 4). Une journée de travail à 8 h devant l'application, c'est ~640 exécutions de ces 8 requêtes.

---

### Problème 3 — Chaque page de cours télécharge toute la bibliothèque (impact **fort**, effort **moyen**)

**Le code** : `app/actions/cours-stagiaire.ts`, fonction `lireSupports()` :

```
.from("supports_seance")
.select("id, seance_id, type, contenu, version, seances(...)")   ← `contenu` = le cours entier
```

Elle ne filtre pas par module : elle rapatrie **tous les supports du groupe**, avec leur contenu complet. Et elle est appelée par `getMesModulesCours()`, `getSommaireModule()`, `getChapitre()` **et** `getJalons()`.

Or, sur la page d'un chapitre (`app/espace-stagiaire/cours/[id]/page.tsx`), on appelle `getChapitre(id)` **puis** `getJalons(moduleId)` : `lireSupports()` s'exécute **deux fois**.

**Pourquoi ça consomme.** 33 supports × 24 Ko ≈ **800 Ko de JSON** transférés puis analysés. Deux fois, soit **1,6 Mo par ouverture de chapitre** — alors que le stagiaire ne lit qu'un seul cours, et que les trois autres appels n'ont besoin que des **titres** et des dates, jamais du contenu.

C'est le coût caché le plus contre-intuitif du projet : la page paraît simple, mais elle brasse l'équivalent d'un livre à chaque clic.

---

### Problème 4 — Le layout formateur refait le travail de la cloche (impact **fort**, effort **facile**)

**Le code** : `app/(protected)/layout.tsx` appelle `getNotifications()`, `getAnneesScolaires()` et `getAnneeCourante()` à chaque rendu — donc sur **chaque page** de votre espace. Avec le proxy et la lecture du rôle, une page formateur, c'est une **douzaine d'allers-retours** vers Supabase avant même d'afficher quoi que ce soit.

Le commentaire du fichier explique pourquoi la pastille vient de la liste (pour éviter que le chiffre saute) : le raisonnement est bon, mais il paie la liste complète — copies comprises — juste pour en compter les éléments.

**Pourquoi ça consomme.** Un `select` qui rapporte 500 Ko coûte le même travail d'analyse, qu'on affiche les données ou qu'on se contente de les compter. Un `count` exact, lui, ne rapporte qu'un nombre.

---

### Problème 5 — Le rôle relu en base à chaque page (impact **moyen**, effort **facile**)

**Le code** : `lib/supabase/server.ts`, `getCurrentUserRole()`. Il cherche d'abord `role_pedago` dans le jeton ; **absent tant que le crochet Supabase n'est pas activé**, il retombe alors sur une lecture de la table `profils`.

C'est exactement l'atome **6.2** du backlog, resté ouvert : la migration est écrite, il manque deux clics dans le tableau de bord Supabase.

**Pourquoi ça consomme.** Une requête HTTP de plus vers Supabase, par page, pour une information que le jeton porterait gratuitement. Ce n'est pas énorme — mais c'est le gain le moins cher de tout ce rapport.

---

### Problème 6 — Le proxy tourne sur plus de choses qu'il ne faudrait (impact **moyen**, effort **facile**)

**Le code** : `proxy.ts`. Le matcher exclut bien `_next/static`, `_next/image`, `favicon.ico` et les images courantes. Mais il laisse passer :

- **toutes les routes `/api/**`** — qui refont elles-mêmes `getUser()` juste après : le jeton est donc vérifié deux fois par appel ;
- les requêtes de navigation interne de Next (RSC), qui sont nombreuses ;
- **vos quatre polices `.ttf`** (`public/polices/*.ttf`) : le matcher exclut `woff` et `woff2`, mais **pas `ttf`**. Chaque visiteur qui arrive sans cache déclenche donc quatre exécutions du proxy — et quatre appels au serveur d'authentification Supabase — rien que pour charger des polices ;
- et demain, tout fichier ajouté dans `public/` avec une extension absente de la liste (`.pdf`, `.json`, `.txt`, `site.webmanifest`).

**Pourquoi ça consomme.** `await supabase.auth.getUser()` n'est pas une vérification locale : c'est un **appel réseau** au serveur d'authentification Supabase, avec démarrage de fonction à chaque fois. Sur une route API qui va de toute façon revérifier l'utilisateur, c'est un aller-retour payé pour rien.

---

### Problème 7 — La fête cherchée à chaque arrivée (impact **moyen**, effort **facile**)

**Le code** : `components/ModaleDistinction.tsx` est monté dans le layout stagiaire et appelle `getDistinctionAFeter()` au montage (deux requêtes). Le commentaire assume le choix : « la fête doit s'ouvrir à l'arrivée, quel que soit l'écran ».

**Pourquoi ça consomme.** 60 stagiaires × plusieurs ouvertures par jour = quelques centaines d'appels quotidiens, pour un événement qui concerne **un** stagiaire et **une** fois. Mesuré en local : 380 à 680 ms par appel.

---

### Problème 8 — Le cours réécrit en HTML à chaque lecture (impact **moyen**, effort **moyen**)

**Le code** : `components/DocumentRedige.tsx` (composant serveur) appelle `analyser()` puis rend l'arbre complet : titres, encadrés en grille, tableaux, listes. Sur un support de 24 Ko, cela fait quelques centaines de nœuds React à fabriquer, **à chaque ouverture, pour chaque stagiaire**.

**Pourquoi ça consomme.** C'est du calcul pur — exactement ce que Vercel facture. Et c'est du calcul **répété à l'identique** : le cours du 7 septembre produira le même HTML pour les quinze stagiaires qui le liront, et le même encore la semaine prochaine.

---

### Problème 9 — Pas de `robots.txt` (impact **faible**, effort **facile**)

Aucun `app/robots.ts`. Les seules pages publiques sont `/`, `/login` et `/definir-mot-de-passe`, donc le risque est limité — mais chaque passage de robot déclenche le proxy, donc un `getUser()`, donc une fonction.

---

### Problème 10 — Rien n'est mis en cache (impact **moyen**, effort **moyen**)

Aucun `revalidate`, aucun `unstable_cache`, aucune page statique. C'est **normal** pour une application derrière authentification — mais certaines données ne dépendent ni de l'utilisateur ni de la minute : la liste des années scolaires, le référentiel, le contenu d'un support publié. Elles sont pourtant relues à chaque affichage.

---

## 3. Ce qui n'est **pas** en cause (vérifié)

- **Les PDF** : tous générés dans le navigateur (`import("@/lib/pdf-…")` depuis des composants client). Zéro CPU serveur. ✅
- **L'attente des appels IA** : DeepSeek met 15 s à répondre, mais le processeur dort pendant ce temps. Le travail autour (découpe du support, validation du JSON) est négligeable. ✅
- **Les crons** : il n'y en a aucun. ✅
- **Les images** : 2 usages de `next/image` seulement, et l'optimisation d'images est facturée à part du CPU. ✅
- **Les requêtes en cascade (N+1)** : le code les évite soigneusement — les lectures sont groupées en `Promise.all`. ✅
- **Les emails Resend** : rares, et l'attente réseau ne coûte presque rien. ✅

---

## 4. Plan de correction, par gain décroissant

| Ordre | Correction | Gain attendu | Effort | Risque |
|---|---|---|---|---|
| **1** | **Espacer la cloche** : passer de 45 s à 5 min. *(La pause quand l'onglet est caché existait déjà — voir la rectification au problème 1.)* | **−85 % des appels serveur** | 10 min | Nul |
| **2** | **Alléger `getNotifications()`** : retirer `responses` du `select`, poser une limite sur `reponses_question`, et ne demander qu'un `count` pour la pastille du layout. | **−200 à −500 Ko par appel** | 30 min | Faible |
| **3** | **Ne plus charger `contenu` dans `lireSupports()`** : le titre suffit pour le sommaire, les jalons et le numéro de chapitre. Charger le contenu seulement pour le chapitre ouvert. | **−1,5 Mo par page de cours** | 1 h | Faible |
| **4** | **Ne pas appeler `getJalons()` si le chapitre n'est pas le dernier de son jalon**, ou fusionner les deux lectures : aujourd'hui `lireSupports()` tourne deux fois sur la même page. | **−50 % sur la page chapitre** | 30 min | Faible |
| **5** | **Activer le crochet de jeton Supabase** (atome 6.2, déjà écrit) : une requête de moins par page formateur. | −1 requête/page | 5 min, chez Supabase | Nul |
| **6** | **Exclure `/api/` et `.ttf` du matcher du proxy**. Les routes API vérifient déjà l'utilisateur, et une police n'a pas de session à rafraîchir. | −1 appel réseau par requête API, −4 par première visite | 10 min | Faible |
| **7** | **Ne charger la fête qu'une fois par jour** : mémoriser la date de la dernière vérification dans `localStorage` et ne redemander qu'au changement de jour. | −300 appels/jour | 20 min | Nul |
| **8** | **Mettre en cache le rendu d'un support** avec `unstable_cache` indexé sur `support_id` + `version`, invalidé à la republication. | −80 % du calcul des pages de cours | 1 h 30 | Moyen |
| **9** | **Ajouter `app/robots.ts`** qui interdit tout sauf `/login`. | Marginal | 5 min | Nul |
| **10** | **Mettre en cache les données stables** (années scolaires, référentiel) avec un `revalidate` d'une heure. | −2 requêtes/page | 45 min | Faible |

**Si vous ne faites que les corrections 1 à 4**, ce qui représente environ deux heures de travail, la consommation devrait tomber **sous 20 % de ce qu'elle est aujourd'hui**. Le reste est du confort.

---

## 5. Ce qu'il faut vérifier dans le tableau de bord Vercel

Avant de corriger, confirmez le diagnostic — mes chiffres sont des estimations tirées du code, pas des mesures.

**Usage → Fluid Active CPU**
1. Regardez la **courbe par jour** : si les pics tombent exactement sur vos journées de cours (et pas la nuit ni le week-end), c'est bien l'usage en séance qui coûte — donc les stagiaires, donc la cloche.
2. Notez la consommation d'un **jour sans cours**. Si elle n'est pas nulle, quelque chose tourne en continu (onglets laissés ouverts = cloche qui sonne toute la nuit).

**Observability → Functions** (ou l'onglet Logs, filtre par route)
3. Triez par **nombre d'invocations**. Ma prédiction : les Server Actions arrivent très loin devant, et l'action des notifications est en tête. Si c'est le cas, le problème 1 est confirmé.
4. Triez par **CPU time** (et non par durée). Ma prédiction : les pages `/espace-stagiaire/cours/[id]` et `/espace-stagiaire/cours/module/[moduleId]` sortent en tête au CPU moyen par appel — c'est le problème 3.
5. Regardez la **taille des réponses** de l'action des notifications. Si vous voyez des centaines de kilo-octets, c'est le problème 2, noir sur blanc.

**Supabase → Reports → API**
6. Comparez le **nombre de requêtes par heure** à votre nombre d'utilisateurs. Si vous voyez des milliers de requêtes par heure pour 15 personnes en séance, la cloche est bien la coupable.

**Un test simple, sans outil** : ouvrez l'application, laissez l'onglet ouvert sans rien toucher pendant 5 minutes, puis regardez l'onglet Réseau de votre navigateur. Vous devriez compter un appel toutes les 45 secondes. C'est le problème 1, visible à l'œil nu.

---

## 6. Checklist pour mes futurs projets Next.js + Supabase sur Vercel

**Le principe** : sur Vercel, on ne paie pas la lenteur, on paie **le nombre d'exécutions × le travail fait à chaque fois**. Tout part de là.

### Middleware / proxy
- [ ] Un matcher qui exclut `_next`, les images, les polices, **et `/api/`** si les routes vérifient déjà l'utilisateur.
- [ ] Rien d'autre dedans qu'un rafraîchissement de session. Aucune requête métier, aucune règle d'autorisation.

### Rendu et cache
- [ ] Ce qui ne dépend ni de l'utilisateur ni de la minute est mis en cache (`revalidate`, `unstable_cache`, `cacheTag`) dès le premier jour.
- [ ] Le contenu long (cours, articles, documents) est mis en cache **par identifiant et version**, jamais reconstruit à chaque lecture.
- [ ] `force-dynamic` et `cache: 'no-store'` : seulement là où c'est démontré, jamais par confort.

### Temps réel
- [ ] **Pas de `setInterval` qui appelle le serveur.** Jamais. C'est le piège n° 1.
- [ ] Pour du temps réel : **Supabase Realtime** (WebSocket, une connexion, zéro exécution de fonction) ou rien.
- [ ] Si un sondage est vraiment nécessaire : **≥ 5 minutes**, arrêté quand `document.hidden`, relancé au retour sur l'onglet.

### Requêtes
- [ ] On ne sélectionne **jamais** de colonne dont on n'affiche pas le contenu — surtout un JSON ou un texte long.
- [ ] Pour un compteur, un `count` exact, jamais une liste qu'on mesure ensuite.
- [ ] Toute requête a une `limit`. Une table qui grossit ne doit pas alourdir une page toute seule.
- [ ] Les lectures indépendantes partent en `Promise.all`, jamais en cascade.
- [ ] Une fonction utilitaire partagée (du genre « lire tous les supports ») ne doit pas charger le lourd pour les appelants qui n'ont besoin que des titres : deux fonctions valent mieux qu'une trop généreuse.

### Répartition client / serveur
- [ ] Les PDF, graphiques et images se fabriquent **dans le navigateur** quand c'est possible. (C'est déjà le cas ici — bon réflexe à garder.)
- [ ] Avec des RLS solides, les lectures simples peuvent se faire **directement depuis le client** : Supabase est appelé sans passer par Vercel, donc sans CPU facturé.
- [ ] Les Server Actions servent à **écrire**, pas à sonder.

### Layouts
- [ ] Un layout tourne sur **toutes** les pages : n'y mettre que le strict nécessaire, et le moins coûteux possible.
- [ ] Le rôle et les droits voyagent dans le **jeton** (custom claims), pas dans une requête par page.

### Surface publique
- [ ] `app/robots.ts` dès le premier déploiement : interdire tout ce qui n'a pas à être indexé.
- [ ] Vérifier qu'aucune page publique ne déclenche de travail serveur coûteux.

### Surveillance
- [ ] Regarder l'onglet Réseau **avec l'application ouverte et immobile** : s'il s'y passe quelque chose, c'est suspect.
- [ ] Une fois par mois, trier les fonctions par nombre d'invocations dans Observability. La surprise est toujours en haut de la liste.

---

## 7. Corrections appliquées

Validées le 26 septembre 2026 : corrections **1, 2, 3, 4 et 6**. Branche `perf-cpu`, un commit par correction, `npm run build` et vérification à l'écran après chacune.

> **Note sur la numérotation** : le tableau des problèmes (§ 2) et le plan (§ 4) ne numérotaient pas la correction 4 de la même façon — l'un désignait le layout formateur, l'autre la double lecture sur la page de cours. C'était un défaut de mon rapport. **Les deux ont été corrigées**, en deux commits distincts.

| Commit | Ce qui change | Fichiers |
|---|---|---|
| `perf: la cloche vérifie toutes les 5 minutes…` | `RYTHME` passe de 45 s à 5 min. La pause quand l'onglet est caché et la relecture au retour existaient déjà. | `components/Cloche.tsx` |
| `perf: la cloche ne transporte plus les copies…` | La règle « copie à corriger » passe en base (vue `v_copies_a_corriger`) : `responses` n'est plus transporté. La lecture des réponses aux questions devient deux lectures ciblées et bornées, au lieu d'une lecture totale sans limite. | `supabase/migrations/103_copies_a_corriger.sql` (nouveau), `app/actions/notifications.ts` |
| `perf: les écrans de cours lisent les titres…` | `lireSupports()` n'extrait plus que le titre (`titre:contenu->>titre`) au lieu de rapatrier les cours entiers. | `app/actions/cours-stagiaire.ts` |
| `perf: une page de cours ne relit plus deux fois…` | `lireSupports()` et `lireProgression()` sont mémorisées pour la durée d'un rendu (`cache()` de React) : `getChapitre` et `getJalons` partagent la même lecture. | `app/actions/cours-stagiaire.ts` |
| `perf: la cloche ne refait pas au montage…` | Quand le serveur a rendu le compte avec la page, la cloche ne relance pas les mêmes lectures à la seconde suivante. Côté stagiaire, où rien n'est rendu par le serveur, la relecture immédiate est conservée. | `components/Cloche.tsx` |
| `perf: le proxy ne tourne plus sur les routes API…` | `api/` et `.ttf` sortent du matcher. Les onze routes `/api` ont été vérifiées une par une : toutes appellent `getUser()` et répondent 401. | `proxy.ts` |

**Mesures relevées pendant la correction**

- Copies : **11,7 Ko en moyenne**, 30 copies en base, soit **343 Ko** transportés puis analysés à chaque vérification de la cloche. C'est ce que la vue supprime.
- Supports de cours : **24 Ko en moyenne**, 33 supports, soit ≈ 800 Ko par lecture — et deux lectures par page de chapitre. C'est ce que les corrections 3 et 4 suppriment.
- Après correction 6, la trace d'une requête `/api/generate/quiz` ne montre plus de passage par `proxy.ts`.

**Ce qui a été vérifié après chaque correction**

- La pastille et le panneau de notifications affichent les mêmes 40 éléments qu'avant, avec les mêmes textes.
- La liste des modules, le sommaire de M202 (4 parties, 13 chapitres, 4 jalons, 23 % de progression, « Reprendre au chapitre 4 ») et la page du chapitre 3 (« Chapitre 3 sur 13 », sommaire latéral, quiz, renvoi au bilan) sont identiques.
- `/api/generate/quiz` répond 401 sans session, et 200 avec 5 questions pour un stagiaire connecté.
- Les polices `.ttf` sont servies normalement.
- `npm run build` passe après chaque commit.

**Ce qui reste à faire**

| Reste | Pourquoi ce n'est pas fait | Effort |
|---|---|---|
| **5 — Activer le crochet de jeton Supabase** | Deux clics dans le tableau de bord Supabase, côté porteur de projet (atome 6.2 du backlog). Une requête de moins par page formateur. | 5 min |
| **7 — La fête cherchée à chaque arrivée** | Non validée. Mémoriser la date de vérification côté navigateur suffirait. | 20 min |
| **8 — Mise en cache du rendu d'un support** | Non validée, et c'est la plus délicate : il faut invalider à la republication, sans quoi un stagiaire lirait une version périmée. | 1 h 30 |
| **9 — `app/robots.ts`** | Non validée. Gain marginal, effort nul. | 5 min |
| **10 — Cache des données stables** (années scolaires, référentiel) | Non validée. | 45 min |

**À refaire dans une semaine** : relire la courbe Usage → Fluid Active CPU de Vercel. Si les corrections tiennent leurs promesses, la consommation quotidienne devrait avoir été divisée par cinq environ. Si ce n'est pas le cas, le § 5 dit où regarder ensuite.
