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

Deux vagues, un commit par correction, `npm run build` et vérification à l'écran après chacune.

- **26 septembre 2026** — corrections **1, 2, 3, 4 et 6**, branche `perf-cpu`.
- **27 septembre 2026** — corrections **7 et 9**, branche `perf-cpu-2`.

> **Note sur la numérotation** : le tableau des problèmes (§ 2) et le plan (§ 4) ne numérotaient pas la correction 4 de la même façon — l'un désignait le layout formateur, l'autre la double lecture sur la page de cours. C'était un défaut de mon rapport. **Les deux ont été corrigées**, en deux commits distincts.

| Commit | Ce qui change | Fichiers |
|---|---|---|
| `perf: la cloche vérifie toutes les 5 minutes…` | `RYTHME` passe de 45 s à 5 min. La pause quand l'onglet est caché et la relecture au retour existaient déjà. | `components/Cloche.tsx` |
| `perf: la cloche ne transporte plus les copies…` | La règle « copie à corriger » passe en base (vue `v_copies_a_corriger`) : `responses` n'est plus transporté. La lecture des réponses aux questions devient deux lectures ciblées et bornées, au lieu d'une lecture totale sans limite. | `supabase/migrations/103_copies_a_corriger.sql` (nouveau), `app/actions/notifications.ts` |
| `perf: les écrans de cours lisent les titres…` | `lireSupports()` n'extrait plus que le titre (`titre:contenu->>titre`) au lieu de rapatrier les cours entiers. | `app/actions/cours-stagiaire.ts` |
| `perf: une page de cours ne relit plus deux fois…` | `lireSupports()` et `lireProgression()` sont mémorisées pour la durée d'un rendu (`cache()` de React) : `getChapitre` et `getJalons` partagent la même lecture. | `app/actions/cours-stagiaire.ts` |
| `perf: la cloche ne refait pas au montage…` | Quand le serveur a rendu le compte avec la page, la cloche ne relance pas les mêmes lectures à la seconde suivante. Côté stagiaire, où rien n'est rendu par le serveur, la relecture immédiate est conservée. | `components/Cloche.tsx` |
| `perf: le proxy ne tourne plus sur les routes API…` | `api/` et `.ttf` sortent du matcher. Les onze routes `/api` ont été vérifiées une par une : toutes appellent `getUser()` et répondent 401. | `proxy.ts` |
| `perf: la fête n'est plus cherchée à chaque page…` | Répit de quinze minutes après une recherche **infructueuse**. Une fête trouvée ne se mémorise jamais. | `components/ModaleDistinction.tsx` |
| `perf: les robots d'indexation n'ont accès qu'à…` | `/robots.txt` : tout interdit sauf `/login`. | `app/robots.ts` (nouveau) |
| `perf: la cloche du stagiaire non plus ne relit au montage` | Ce que le serveur a lu en rendant la page descend jusqu'à la cloche, des deux côtés. Un seul mécanisme remplace les deux : ce n'est plus un compte qui descend mais un identifiant et une date par notification. | `components/Cloche.tsx`, `components/AppShell.tsx`, `components/Topbar.tsx`, `components/ClocheStagiaire.tsx`, `app/(protected)/layout.tsx`, `app/espace-stagiaire/layout.tsx` |

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

### La fête : pourquoi quinze minutes, et pas « une fois par jour »

Le plan (§ 4, correction 7) proposait de ne chercher la fête qu'une fois par jour. **C'était faux, et il fallait le dire avant de coder** : le stagiaire du jour est désigné à la **clôture de la séance**, donc en fin d'après-midi. Un stagiaire venu le matin aurait vu la fête le lendemain — la perte exacte qu'il fallait éviter.

Le répit ne dure donc que quinze minutes, et il ne s'écrit **qu'après une recherche vide**. Ce que cela change, cas par cas :

| Situation | Avant | Après |
|---|---|---|
| Il revient le soir, après la clôture | il voit la fête | identique |
| Il navigue à l'instant de la clôture | au prochain chargement de page | au prochain chargement passé quinze minutes |
| Il ouvre l'application le lendemain | il voit la fête | identique |

Le pire cas est un quart d'heure de retard, pour le seul stagiaire qui naviguait pendant la clôture. Aucune fête n'est perdue : c'est toujours `distinctions_vues` qui éteint la modale, une fois fermée.

**Vérifié** : sans répit en mémoire, la recherche part (une trace `getDistinctionAFeter()` dans le journal) ; avec un répit récent, les chargements de page suivants n'en déclenchent aucune. `/robots.txt` est servi avec `Allow: /login` puis `Disallow: /`, et la page de connexion répond toujours 200.

**Ce qui reste à faire**

| Reste | Pourquoi ce n'est pas fait | Effort |
|---|---|---|
| **5 — Activer le crochet de jeton Supabase** | Deux clics dans le tableau de bord Supabase, côté porteur de projet (atome 6.2 du backlog). Une requête de moins par page formateur. | 5 min |
| **8 — Mise en cache du rendu d'un support** | Non validée, et c'est la plus délicate : il faut invalider à la republication, sans quoi un stagiaire lirait une version périmée. | 1 h 30 |
| **10 — Cache des données stables** (années scolaires, référentiel) | Non validée. | 45 min |

### La cloche du stagiaire : pourquoi un aperçu, et pas un compte

Côté formateur, le gabarit rendait déjà le nombre de notifications ; il suffisait que la cloche s'en contente. Côté stagiaire, **un nombre n'aurait pas suffi** : sa pastille ne montre que ce qui est arrivé **depuis son dernier regard**, un horodatage gardé dans son navigateur et que le serveur ignore. Un compte total rendu par le serveur aurait affiché « 35 » à un stagiaire qui a tout lu — une pastille qui ment pendant cinq minutes, jusqu'au premier tour de minuterie.

Ce qui descend est donc un **identifiant et une date par notification** : de quoi refaire exactement le calcul d'avant, côté navigateur, sans rien demander. Les deux espaces partagent désormais le même mécanisme.

**Vérifié** : pastille à 0 quand tout a été vu, à 35 dès 600 ms après effacement du repère de dernier regard — et aucune lecture ne part au montage (aucune trace de `getNotificationsStagiaire()` après un chargement de page).

### La vue `v_copies_a_corriger` n'ouvre rien de plus

Une vue peut contourner les politiques de ses tables : par défaut elle s'exécute avec les droits de son propriétaire, et rendrait alors à tout le monde ce que son propriétaire peut lire. Celle-ci est créée `with (security_invoker = on)` — vérifié en base : `reloptions = {security_invoker=on}` —, donc elle lit sous l'identité de l'appelant.

Vérifié sur une vraie copie rendue incomplète dans une transaction annulée (aucune donnée modifiée) :

| Qui regarde | Lignes dans la vue |
|---|---|
| Sans politiques (clé de service) | 1 — la copie de Y. L. |
| **Un autre stagiaire du groupe** | **0** |
| Le stagiaire propriétaire de la copie | 1 — la sienne, et seulement la sienne |
| Le formateur du groupe | 1 |

La bonne formulation n'est donc pas « un stagiaire n'y lit rien », mais **« un stagiaire n'y lit rien de plus que ce que `passations_controle` lui accorde déjà »** : la même session lit déjà ses deux copies dans la table elle-même. La vue n'élargit aucun accès ; elle déplace un test de JavaScript vers SQL.

### Appliquer la migration en production

La base liée au projet (`supabase/.temp`, URL `jzvjxq….supabase.co`) est celle que sert l'application : **la migration 103 y est déjà appliquée**, `npx supabase db push` ayant poussé en ligne. L'ordre à respecter est donc déjà respecté, et il vaut pour les prochaines fois :

1. **La migration d'abord**, code non déployé : `npx supabase db push`. La vue apparaît ; rien ne l'utilise encore, donc rien ne peut casser.
2. **Le code ensuite** : `git push`, puis le déploiement Vercel.

L'inverse casserait la cloche du formateur entre les deux : le nouveau code demande `v_copies_a_corriger`, et PostgREST répondrait `relation does not exist`. La cloche avale ses erreurs (`catch` silencieux), donc la pastille se figerait sans message — une panne muette, la pire sorte.

Dans ce sens-ci, l'entre-deux est inoffensif : la vue existe sans être lue, et l'ancien code continue de fonctionner tel quel. Aucun retour arrière n'est nécessaire si le déploiement échoue.

### Une erreur rencontrée pendant les essais, sans rapport avec ces corrections

Une page a échoué une fois sur `PGRST303 — JWT issued at future`. C'est un **décalage d'horloge** : le jeton venait d'être créé par la machine de développement, dont l'heure est légèrement en avance sur celle de Supabase, et PostgREST refuse un jeton daté du futur. Ce n'est pas causé par l'absence du crochet de jeton — le crochet ne ferait que rendre cette lecture inutile dans ce cas précis, il ne corrigerait pas les horloges. Le vrai remède est la synchronisation d'horloge côté machine.

**À refaire dans une semaine** : relire la courbe Usage → Fluid Active CPU de Vercel. Si les corrections tiennent leurs promesses, la consommation quotidienne devrait avoir été divisée par cinq environ. Si ce n'est pas le cas, le § 5 dit où regarder ensuite.

---

## 8. Deuxième audit — 28/09/2026

Les corrections du premier audit sont en ligne depuis le 27 septembre. La
consommation a baissé d'environ **40 %**, pas de 80 % comme annoncé. Voici
pourquoi, et quoi faire maintenant.

Ce que disent les captures Vercel :

| | Avant | Aujourd'hui (journée non finie) |
| --- | --- | --- |
| Un jour de cours | 9 à 14 min | 7 min 25 s |
| Part « function » | — | 4 min 52 s (65 %) |
| Part « middleware » (proxy) | — | 2 min 35 s (35 %) |

La part « function » a bien baissé. La part « middleware » n'a presque pas
bougé. **Aucune correction du premier audit ne visait ce qui la fait tourner.**

### 8.1 Ce qui déclenche encore le proxy

Le proxy ne s'exécute pas seulement quand on change de page. Il s'exécute sur :

1. **Le chargement d'une page** — normal, c'est fait pour ça.
2. **La navigation entre deux pages** — normal aussi.
3. **Les préchargements (« prefetch »)** — **c'est là qu'est le problème.**
4. **Les Server Actions** — un « j'aime », un commentaire, un enregistrement.
   Peu nombreux, ce n'est pas le sujet.

Le préchargement, c'est Next.js qui va chercher une page **à l'avance**, sans
qu'on ait cliqué. Il le fait pour **chaque lien qui apparaît à l'écran**, et
seulement en production — c'est pour cela qu'on ne le voit jamais en local.

Combien de liens par écran ? Mesuré sur l'application, liens distincts :

| Écran | Liens |
| --- | --- |
| Progression d'un groupe | **40** |
| Fiche d'un groupe | 30 |
| Modules | 16 |
| Calendrier | 15 |
| Tableau de bord | 11 |
| Liste des groupes | 11 |

Ouvrir la progression d'un groupe, c'est donc **jusqu'à 41 exécutions du
proxy** : la page, plus quarante préchargements. Et chaque exécution du proxy
appelle Supabase pour vérifier qui vous êtes.

Vérifié aussi : **aucun `prefetch={false}` dans le projet**, et **aucun
fichier `loading.tsx`**. Autrement dit, rien ne freine les préchargements
nulle part.

### 8.2 Peut-on exclure les préchargements ? Oui, sans risque

Next.js marque ses préchargements avec un en-tête : `next-router-prefetch`. Le
matcher du proxy sait exclure une requête à cause d'un en-tête — c'est écrit
dans la documentation de Next 16 livrée avec le projet
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`,
option `missing`).

Pourquoi c'est sans risque pour la session : un préchargement n'est pas une
visite. Personne ne regarde la page à ce moment-là. La session sera rafraîchie
à la vraie navigation qui suit, comme aujourd'hui. Et le seul rôle du proxy est
justement ce rafraîchissement — il ne décide d'aucune autorisation (voir le
commentaire en tête de `proxy.ts`). Les vraies barrières sont les policies RLS
de Postgres et les redirections dans les layouts : elles ne bougent pas.

**Attention à ne pas confondre** : il ne faut **pas** exclure sur le paramètre
`_rsc`, que portent aussi les vraies navigations. Il faut exclure sur l'en-tête
de préchargement, et lui seul.

### 8.3 `getUser()` ou `getClaims()` ?

Le proxy appelle aujourd'hui `supabase.auth.getUser()`, qui envoie une requête
réseau à Supabase à **chaque** exécution.

`getClaims()` peut vérifier le jeton **sur place**, sans réseau. Trois choses
vérifiées dans le code installé :

1. **Le projet s'y prête.** Les jetons sont signés en `ES256` (clé asymétrique,
   `kid` présent). Avec l'ancien secret partagé `HS256`, `getClaims()` serait
   retombé sur `getUser()` et n'aurait rien changé du tout.
2. **Le rafraîchissement est conservé.** `getClaims()` commence par
   `getSession()`, qui renouvelle le jeton s'il est près d'expirer. L'effet de
   bord qu'on recherche reste là.
3. **Mais le cache des clés est par client, pas global.** Le proxy crée un
   client neuf à chaque requête : tel quel, `getClaims()` irait chercher le
   trousseau de clés (`jwks.json`) à chaque fois — on remplacerait un appel
   réseau par un autre. Il faut lire le trousseau **une fois**, le garder dans
   une variable de module, et le passer à `getClaims()` (option `keys`).

**Et surtout** : Vercel facture le **temps de calcul**, pas l'attente réseau
(§ 0). Supprimer un appel réseau améliore la **rapidité**, mais ne réduit pas
forcément la **facture** — la vérification de signature `ES256`, elle, est du
calcul. Ce changement est bon pour l'utilisateur ; ce n'est pas le levier du
quota.

**Ce qui réduit la facture, c'est le nombre d'exécutions, pas leur contenu.**

### 8.4 Le proxy fait-il autre chose ?

Non. Il crée le client Supabase, appelle `getUser()`, recopie les cookies
rafraîchis, et rend la réponse. Aucune redirection, aucune lecture de rôle,
aucun test d'autorisation. De ce côté, il n'y a rien à retirer.

### 8.5 Côté « function » : ce qui coûte le plus

Le plus gros poste est le même des deux côtés : **ce que le gabarit (layout)
lit avant même la page**.

| Gabarit | Lectures en base par chargement de page |
| --- | --- |
| Espace formateur | **12** — dont 9 pour la seule cloche (`getNotifications`) |
| Espace stagiaire | **4 à 6** |

Et la page la plus visitée de tout le projet, le fil du stagiaire, ajoute
**une dizaine de lectures** par-dessus (annonces, réactions, commentaires,
camarades, distinctions, classements, réactions aux commentaires…). C'est
l'écran d'arrivée de soixante personnes.

La règle du `CLAUDE.md` — « les layouts tournent sur toutes les pages : y
mettre le minimum » — n'est pas respectée par le gabarit formateur. La cloche
n'a besoin que d'un identifiant et d'une date par notification ;
`getNotifications` construit en plus tous les textes, les extraits, les noms et
les photos, puis on jette tout sauf deux champs.

### 8.6 L'état des branches

À la date de cet audit, depuis cette machine, `git fetch` ne peut pas joindre
le dépôt : **impossible de vérifier ici ce qui est réellement déployé.**

- `perf-cpu` : d'après vous, en ligne depuis le 27 septembre. Cohérent avec la
  baisse de la part « function ».
- `perf-cpu-2` (corrections 7 et 9) : **non vérifiable d'ici**. Test simple :
  ouvrir `/robots.txt` sur le site en ligne. S'il affiche `Disallow: /`, la
  branche est en ligne. Sinon elle ne l'est pas.
- Gain restant si `perf-cpu-2` n'est pas déployée : **faible**. La correction 7
  (la fête) économise une lecture par arrivée sur l'espace stagiaire ; la
  correction 9 (`robots.txt`) empêche les robots d'indexer — utile, mais ce
  n'est pas ce qui remplit le quota.

### 8.7 La mesure — ce que la correction 1 a donné

Mesuré le 28/09/2026 sur une **build de production lancée en local**
(`npm run build && npx next start -p 3002`), donc sans toucher au quota Vercel.
Instruments temporaires, retirés depuis : un en-tête `x-pedago-proxy` posé par
le proxy, et une ligne de journal au début de chaque gabarit.

**a) Les préchargements partent bien tout seuls.** Sur la progression d'un
groupe, sans le moindre clic : **environ 35 requêtes de préchargement**, rien
qu'en affichant l'écran et en le faisant défiler. Sur l'écran d'arrivée du
stagiaire : **9 requêtes, 5 pages distinctes** (Fil, Cours, Devoirs, Contrôles,
Emploi du temps — les deux barres de navigation, haute et basse, pointent les
mêmes adresses).

**b) Ils ne réveillent plus le proxy.** Trois requêtes sur la même page, pour
comparer :

| Requête | Proxy exécuté | Réponse |
| --- | --- | --- |
| Chargement de page | **oui** | 82 Ko |
| Navigation entre pages (`_rsc`) | **oui** | 60 Ko |
| Préchargement | **non** | 330 octets |

C'est exactement le but, et c'est aussi la preuve qu'il ne fallait **pas**
exclure sur `_rsc` : la vraie navigation le porte aussi, et l'exclure aurait
cessé de rafraîchir la session dès qu'on ne recharge plus la page entière.

**c) Un préchargement n'exécute ni la page ni les gabarits.** C'est le résultat
le plus important, et il n'était pas prévu.

| Ce qu'on a fait | Préchargements partis | Gabarits exécutés côté serveur |
| --- | --- | --- |
| Ouvrir la progression d'un groupe | ~35 | **1** (le vrai chargement) |
| Arriver sur le fil du stagiaire | 9 | **1** (le vrai chargement) |
| Trois requêtes contrôlées (page, navigation, préchargement) | 1 | **2** sur 3 |

Le préchargement rend 330 octets et ne lit rien en base. La raison : il n'y a
**aucun `loading.tsx`** dans le projet, donc Next n'a aucune frontière où
s'arrêter et se contente de rendre une coquille vide.

**d) Connexion, déconnexion et navigation : intactes.** Connexion par lien
magique côté formateur et côté stagiaire, quatre navigations d'affilée dans
l'espace stagiaire (Fil → Cours → Devoirs → Contrôles → Fil), puis déconnexion
— après quoi `/dashboard` et `/espace-stagiaire/fil` renvoient bien vers la
page de connexion.

### 8.8 Ce que la mesure change au plan

Deux corrections prévues **tombent**, et pour la même raison : un préchargement
ne coûte plus rien du tout.

**La correction 2 (`loading.tsx`) est à écarter — elle ferait le contraire de
ce qu'on cherche.** Sans frontière, un préchargement rend 330 octets. Avec un
`loading.tsx`, on lui donne justement quelque chose à rendre : la coquille
au-dessus de la frontière, **gabarit compris** — c'est-à-dire les douze
lectures en base du gabarit formateur, multipliées par quarante préchargements.
`loading.tsx` reste une bonne idée pour le **confort** (un écran d'attente
plutôt qu'une page figée), mais il faudrait alors le payer. À décider comme un
choix de confort, jamais comme une économie.

**La correction 4 (`prefetch={false}`) n'a plus d'objet.** Elle visait le coût
des préchargements ; ils ne coûtent plus ni proxy ni fonction. La retirer
n'économiserait rien et rendrait la navigation moins vive.

**Reste la correction 3, qui devient la première.** Le gabarit formateur lit
douze fois la base à chaque chargement de page, dont neuf pour la seule cloche,
et on jette tout sauf un identifiant et une date par notification. C'est
maintenant le plus gros poste identifié.

### 8.9 Le plan révisé, après mesure

| # | Correction | Gain estimé | Risque | Temps | État |
| --- | --- | --- | --- | --- | --- |
| 1 | Exclure les préchargements du proxy | **−25 à −30 %** | très faible | 15 min | **fait**, mesuré |
| 2 | Alléger la cloche dans le gabarit formateur | −10 à −15 % | faible | 1 h | à faire |
| 3 | `getClaims()` avec trousseau en cache de module | rapidité, pas facture | faible | 45 min | optionnel |
| — | ~~`loading.tsx`~~ | **augmenterait** le travail | — | — | **écartée** |
| — | ~~`prefetch={false}`~~ | plus d'objet | — | — | **écartée** |

Ce qu'il faut regarder ensuite dans Vercel : la part « middleware », qui doit
passer de 35 % à une dizaine de pour cent. Si elle ne bouge pas, c'est que les
préchargements n'étaient pas le gros du trafic en vrai usage, et il faudra
compter les invocations par type dans l'onglet Observability.

### 8.10 Comment refaire la mesure

Les préchargements **n'existent pas en `npm run dev`** : Next les désactive
hors production. Il faut une build de production, mais **en local** :

```bash
npm run build && npx next start -p 3002
```

Puis, dans la console du navigateur, compter ce qui est parti sans clic :

```js
performance.getEntriesByType('resource').filter((r) => r.name.includes('_rsc='))
```

Rien de tout cela ne passe par Vercel : le quota n'est pas touché.

---

## 9. Troisième audit — 09/10/2026

Après `perf-cpu-3`. Le proxy est passé de 35 % à 15 % : la correction des
préchargements a fait son travail. Mais la part « function » n'a presque pas
bougé, et c'est elle qui tient les 84 % du quota.

**Lecture seule : aucun fichier de code n'a été modifié pendant cet audit.**

### 9.0 Le compte à tenir

| | |
| --- | --- |
| Quota | 4 h sur 30 jours glissants, soit **240 minutes** |
| Consommé | 3 h 22, soit **202 minutes** — 84 % |
| Moyenne actuelle | **6,7 minutes par jour** |
| Objectif annoncé | sous 6 minutes, soit 180 minutes sur 30 jours |

Il faut donc retirer **une vingtaine de minutes par mois** pour seulement
revenir à l'objectif, et davantage pour avoir de la marge. Un jour de cours
coûte aujourd'hui 5 à 14 minutes ; un jour sans cours, 2 à 5.

### 9.1 Les cinq postes les plus chers

Une précision d'abord, parce qu'elle change la façon de lire ce qui suit :
**je ne vois pas les chiffres par fonction depuis le dépôt.** Le classement
ci-dessous n'est pas une mesure, c'est un raisonnement : combien de fois une
chose tourne, multiplié par le travail qu'elle fait. Pour le confirmer :
Vercel → Observability → Functions, trier par CPU time.

#### 1. Le fil du stagiaire — `getFil` (`app/actions/fil.ts`)

C'est l'écran d'arrivée de soixante personnes, et le seul endroit du projet
dont le coût **grandit tout seul avec l'année scolaire**.

La première requête lit **toutes les annonces du groupe**, sans limite et sans
fenêtre de dates, avec leur texte entier. Puis, pour toutes ces annonces à la
fois : les réactions, les commentaires, les camarades, les distinctions, les
classements — et enfin les réactions aux commentaires. Sept lectures, puis
tout est recousu en mémoire.

En septembre, dix annonces. En juin, deux cents — avec leurs réactions et
leurs commentaires, relues en entier à chaque ouverture du fil, par chaque
stagiaire, plusieurs fois par jour.

La règle du `CLAUDE.md` — « toute requête a une limite » — n'est pas respectée
ici, et c'est la requête où cela coûte le plus cher.

#### 2. Le gabarit formateur — `app/(protected)/layout.tsx`

**Treize à quatorze lectures avant même d'afficher la page**, et il tourne à
chaque navigation : la session, le rôle, les années, l'année courante, le
profil, et **neuf requêtes pour la seule cloche**.

Le deuxième audit l'avait déjà noté. Rien n'a changé depuis : `getNotifications`
construit les textes, les extraits, les noms et les photos de chaque
notification, et le gabarit **jette tout sauf l'identifiant et la date**.

#### 3. Le gabarit stagiaire — `app/espace-stagiaire/layout.tsx`

Même forme, plus léger : huit lectures environ par navigation, dont six pour
la cloche. Mais il tourne pour soixante personnes au lieu d'une.

#### 4. Les routes de génération — `lib/llm.ts`

Celui-là ne se devine pas. Les appels au modèle passent par
`.stream(...).finalMessage()` : la fonction **lit la réponse morceau par
morceau**, des milliers de fragments à analyser, puis attend la fin et ne
garde que le texte complet.

Or rien n'est montré au navigateur pendant ce temps. On paie donc le coût du
flux sans en tirer le bénéfice. Une génération de 8 000 jetons, c'est quelques
milliers de fragments analysés dans la fonction facturée.

#### 5. Le rôle relu en base — `getCurrentUserRole` (`lib/supabase/server.ts`)

La fonction cherche `role_pedago` dans le jeton. S'il n'y est pas, elle le lit
dans la table `profils`. **Le crochet JWT de Supabase n'ayant jamais été
activé, c'est le chemin de repli qui sert — une lecture de plus sur chaque
page, des deux côtés.**

### 9.2 Le dimanche : qu'est-ce qui tourne sans cours ?

Le dimanche 4 octobre a coûté environ 5 minutes. Voici ce qui peut tourner, du
plus probable au moins probable.

**a) Un onglet resté ouvert — le plus probable.** La cloche interroge le
serveur **toutes les 5 minutes** (`components/Cloche.tsx`). Elle s'arrête bien
quand l'onglet passe en arrière-plan, mais **pas quand l'onglet reste visible
sans que personne ne le regarde** : un portable ouvert sur la page, un second
écran, un téléphone posé.

Un seul onglet visible toute la journée :

| | |
| --- | --- |
| Appels | 12 par heure, soit **≈ 290 par jour** |
| Lectures en base | 9 par appel (formateur), 6 (stagiaire) |

Soixante stagiaires n'ont pas besoin de laisser l'onglet ouvert pour que cela
compte : deux ou trois suffisent.

**b) Les visites réelles.** Un dimanche, un stagiaire ouvre l'application pour
voir ses notes, un cours, un devoir à rendre. Chaque visite, c'est le gabarit
(8 lectures) plus la page.

**c) Ce qui ne tourne pas, vérifié.** Il n'y a **aucune tâche planifiée** : pas
de `vercel.json`, donc pas de cron. Le temps réel passe directement à Supabase
et ne touche pas le quota Vercel. Les robots sont écartés par `robots.ts`.

**Pour trancher** : Vercel → Observability → Functions, filtrer sur le
dimanche, trier par nombre d'invocations. Si une action de notifications
domine, ce sont les onglets ouverts. Si ce sont des pages, ce sont des visites.

### 9.3 Les erreurs de production ajoutent-elles du CPU ?

**L'identifiant vide (`uuid ""`) : oui, mais peu.** Quand la requête échoue, le
travail a déjà été fait ; l'erreur remonte, et Next rend **une seconde page**,
celle d'erreur. Une page demandée, deux rendus facturés. Cela n'arrive que
lorsqu'aucune année scolaire n'est lisible, donc rarement — mais c'est du
gaspillage pur.

**L'IA : oui, et beaucoup plus.** Deux raisons.

D'abord, une génération qui échoue a quand même coûté son analyse de flux : on
paie tout le travail, et on n'a rien.

Ensuite, et c'est le point à vérifier : dans `lib/llm.ts`, l'appel demande une
option bêta (`server-side-fallback`). Si l'organisation ne l'a pas ouverte,
l'API répond `400`, et le code **refait l'appel en entier**. Chaque génération
coûterait alors **deux appels complets** au lieu d'un.

**Le test** : chercher `[llm] repli serveur indisponible` dans les journaux
Vercel. Si la ligne apparaît, la condition est réunie — et c'est une
correction d'une ligne.

### 9.4 Le plan, par gain décroissant

| # | Quoi | Gain | Risque | Temps |
| --- | --- | --- | --- | --- |
| 1 | Activer le crochet JWT Supabase | moyen | **nul** | 10 min |
| 2 | Vérifier le `[llm] repli serveur indisponible` | moyen | **nul** | 5 min |
| 3 | Borner le fil : fenêtre de dates, limite, et ne plus lire le texte entier des annonces anciennes | **fort** | faible | 1 à 2 h |
| 4 | Alléger la cloche du formateur : une requête de comptage au lieu de neuf | fort | moyen | 2 à 3 h |
| 5 | Ne plus streamer les appels au modèle | moyen | faible | 30 min |
| 6 | Mettre la cloche en pause après quelques minutes sans geste, onglet visible ou non | moyen | faible | 30 min |
| 7 | Mettre en cache ce qui ne dépend ni de l'utilisateur ni de la minute : années scolaires, profil | moyen | faible | 1 h |

### 9.5 Ce que je ferais en premier

**Les numéros 1 et 2, ce soir.** Quinze minutes à eux deux, aucun risque,
aucun code à écrire — un réglage dans Supabase et une recherche dans les
journaux. Le premier retire une lecture de **chaque page** des deux espaces.
Le second dira si vos générations coûtent le double depuis le début.

**Puis le numéro 3.** C'est là qu'est l'argent, et c'est le seul poste dont le
coût augmente tout seul : ne rien faire aujourd'hui, c'est payer plus cher en
juin qu'en octobre.

Le numéro 4 vient après parce qu'il demande de réécrire la cloche, et qu'une
cloche cassée se voit tout de suite.

### 9.6 Ce que cet audit n'a pas pu faire

Je n'ai pas mesuré : pas d'accès au détail par fonction, et aucun instrument
posé — c'était un audit en lecture seule. Tout ce qui est écrit ici est une
déduction depuis le code, et chaque point porte le moyen de le vérifier
soi-même dans Vercel. À confirmer avant de corriger quoi que ce soit.

### 9.7 Corrections appliquées — branche `perf-cpu-4`

Deux corrections sur les sept du plan. Pas poussées.

#### Points 1 et 2 du plan : ce qui a été vérifié

**Le crochet JWT.** Vous l'avez activé dans Supabase. **Aucun code n'était à
changer** : `getCurrentUserRole` lit déjà `role_pedago` dans le jeton et ne
descend vers la table `profils` que si la revendication manque.

Une précision qui compte : **une session ouverte avant l'activation garde son
ancien jeton.** La revendication n'y entre qu'au renouvellement. Pour le
vérifier vous-même, dans la console du navigateur, connecté :

```js
JSON.parse(atob(
  JSON.parse(localStorage.getItem(
    Object.keys(localStorage).find((k) => k.endsWith("-auth-token"))
  )).access_token.split(".")[1]
)).role_pedago
```

`"formateur"` : le crochet marche, la lecture de `profils` a disparu.
`undefined` : déconnectez-vous et reconnectez-vous, puis refaites le test.

**Le repli serveur de l'IA.** Vous n'avez pas rempli la réponse dans votre
message — la case `[OUI / NON]` est restée vide. **Je ne l'ai donc pas
traitée.** Si la ligne `[llm] repli serveur indisponible` apparaît dans vos
journaux, chaque génération coûte deux appels complets depuis le début, et la
correction tient en une condition.

#### Correction 3 — le fil est borné

**Quatre** annonces à l'ouverture — ce qu'on voit sans défiler, et ce qu'un
stagiaire vient réellement lire en arrivant. Un lien « Afficher plus
d'annonces » en ajoute vingt à chaque clic. Les réactions, commentaires et
réactions aux commentaires ne portent que sur les annonces chargées.

Le pas est de vingt et non de quatre : remonter à octobre demanderait sinon
vingt-cinq clics, et chaque clic est un rendu de page facturé. Le coût est dans
la première ouverture, qui arrive des dizaines de fois par jour ; celui qui
cherche une vieille annonce le fait une fois.

| Clic | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| Annonces lues | 4 | 24 | 44 | 64 | 84 | 104 |

**L'écran du formateur en garde vingt.** Il gère ses annonces depuis une autre
liste, mais c'est là qu'il lit ce qu'on lui a répondu, et quatre
l'aveugleraient. Cet écran s'ouvre quelques fois par jour, pas des dizaines.

La fenêtre vit **dans l'adresse** (`?annonces=40`) et non dans un état du
navigateur. Première version essayée puis abandonnée : une liste tenue côté
client, qui s'allongeait sans recharger. Elle cassait les commentaires — ils se
rafraîchissent par un nouveau rendu du serveur, et l'état client aurait figé la
liste : **un commentaire posté ne serait jamais apparu.** Dans l'adresse, la
fenêtre survit au rafraîchissement et se partage.

La fenêtre est bornée des deux côtés, entre 4 et 200 : un paramètre d'adresse
se trafique.

| Demandé dans l'adresse | Annonces lues |
| --- | --- |
| rien, `abc`, `0`, `-5` | 4 |
| `24` | 24 |
| `99999` | 200 |

**Les épinglées : sans objet.** Le cahier des charges demandait qu'elles
restent visibles. La migration 110 a supprimé la colonne `epinglee` et la
fonctionnalité a été abandonnée : il n'y en a plus.

**Ce que le stagiaire perd :** rien, sauf un clic pour descendre plus bas que
son écran. Le compte d'annonces disparaît de l'en-tête — la page ne les lit
plus toutes, et annoncer un nombre qu'on n'a pas compté serait inventer.

#### Correction 6 — la cloche se tait

Dix minutes sans geste — pointeur, clavier, molette, toucher, défilement — et
elle cesse d'interroger le serveur. Au premier geste suivant elle relit tout de
suite, sans attendre son tour.

Simulé sur vingt-quatre heures, onglet **visible** :

| Situation | Appels par jour |
| --- | --- |
| Avant | **287** |
| Onglet ouvert, personne devant | **2** |
| Huit heures de cours, puis la page reste ouverte | **97** |
| Un coup d'œil toutes les heures | **94** |

Chaque appel vaut neuf lectures en base côté formateur, six côté stagiaire.

#### Ce qui a été vérifié, et ce qui ne l'a pas été

Vérifié : `npm run verifie` et `npm run build` passent ; une build de
production lancée en local (`npx next start -p 3002`) démarre sans erreur ;
`/espace-stagiaire/fil` répond sur les quatre valeurs de fenêtre, y compris
`abc` et `99999` ; le bornage et le rythme de la cloche simulés hors
navigateur.

**Pas vérifié :** ni le fil ni la cloche n'ont été vus fonctionner. Les deux
vivent derrière l'authentification, et cette session n'a pas de session
ouverte. À faire en trois minutes avant de fusionner :

1. Ouvrir le fil : compter les cartes, il doit y en avoir quatre au plus.
2. Cliquer « Afficher plus d'annonces » : l'adresse passe à `?annonces=24`, la
   page ne remonte pas en haut.
3. Poster un commentaire sur une annonce : il doit apparaître.
4. Laisser l'onglet ouvert sans y toucher un quart d'heure, puis bouger la
   souris : la pastille doit se mettre à jour immédiatement.

**Et ceci : `git fetch` ne peut toujours pas joindre le dépôt depuis cette
machine** — la clé SSH demande une phrase secrète. La branche part de `main`
local, à `0f84bba` (PR #74). Si votre `git pull` a fait descendre autre chose,
`perf-cpu-4` est à rebaser.

### 9.8 Le repli serveur : hypothèse écartée, et une erreur d'audit

**La ligne `[llm] repli serveur indisponible` n'est pas dans les journaux.**
L'option bêta est donc acceptée : **aucune génération ne part deux fois.**
L'hypothèse de la §9.3 est écartée, et le point 2 du plan ne rapporte rien.

Et en vérifiant cela, je trouve que **la correction 5 du plan était une
erreur.** Je la retire.

J'avais écrit que `.stream(...).finalMessage()` faisait payer l'analyse d'un
flux sans en tirer le bénéfice, puisque rien n'est montré au navigateur. Deux
choses m'avaient échappé.

D'abord, le code dit déjà pourquoi, à l'endroit même que j'ai lu :

> Diffusion systématique : le formateur peut régler `max_tokens` très haut,
> et une requête non diffusée finirait en délai dépassé.

C'est aussi la recommandation d'Anthropic : diffuser dès que la sortie peut
être longue, et appeler `finalMessage()` quand on n'a pas besoin des
évènements. Le code fait exactement cela.

Ensuite, j'ai surestimé le coût. Analyser quelques milliers de fragments
représente des dizaines de millisecondes, pas des secondes. Ce n'était pas un
poste de dépense.

**Ce qui reste vrai de la §9.3 :** une génération qui échoue a quand même
coûté son travail. C'est inévitable, et ce n'est pas ce qui remplit le quota.

### 9.9 Le plan, révisé

| # | Quoi | Gain | Risque | Temps | État |
| --- | --- | --- | --- | --- | --- |
| 1 | Crochet JWT Supabase | moyen | nul | 10 min | **fait** |
| 2 | Vérifier le repli serveur | — | nul | 5 min | **fait — rien à corriger** |
| 3 | Borner le fil | fort | faible | 1 à 2 h | **fait** |
| 6 | Pause de la cloche sans activité | moyen | faible | 30 min | **fait** |
| 4 | Alléger la cloche du formateur : une requête au lieu de neuf | **fort** | moyen | 2 à 3 h | à faire |
| 7 | Mettre en cache années scolaires et profil | moyen | faible | 1 h | à faire |
| 5 | ~~Ne plus streamer les appels au modèle~~ | — | — | — | **retirée, c'était une erreur** |

**La mesure avant de continuer.** Quatre des sept points sont faits, et deux
d'entre eux touchent ce qui tourne le plus souvent. Avant d'attaquer le point
4, qui demande de réécrire la cloche, il vaut mieux laisser passer quelques
jours de cours et regarder la courbe : si elle descend assez, le point 4 peut
attendre — et une cloche réécrite est une cloche qui peut se casser.

## 10. Le pic du 15 octobre : la correction IA

Le jeudi 15 octobre 2026 : environ **12 minutes** de CPU actif, contre 4 à 5
pour un jour de cours normal. Ce jour-là, vous avez corrigé des contrôles avec
le correcteur IA.

**Lecture seule : aucun fichier de code ni aucune donnée n'a été modifié.**

### 10.0 Sur quoi repose cette section

**La base n'a pas été lue depuis cette machine** : ni fichier `.env`, ni
`psql`, ni CLI Supabase, ni connecteur. Trois sources à la place :

- **le code**, lu en entier sur le chemin de la correction ;
- **le graphique Vercel** « Fluid Active CPU », découpé par type (function /
  middleware), jour par jour. Le plan Hobby ne donne pas le détail par
  fonction : on ne voit pas *quelle* page a coûté, seulement *combien* ;
- **le dossier d'épreuve** édité par la plateforme le 19/10 (EFM Local M202,
  groupe DDOUX201), qui porte chaque copie, chaque question, chaque note,
  chaque commentaire et la date de publication.

Les requêtes de la §10.6 restent utiles pour un chiffre précis : le nombre
exact de clics « Valider et continuer ». Elles ne sont plus nécessaires pour
confirmer la cause.

### 10.1 Confirmer la cause

**Ce qui s'est passé, d'après le dossier d'épreuve :**

| | |
| --- | --- |
| L'épreuve | EFM Local M202, mercredi **14/10**, de 13 h 30 à 17 h 30 |
| Les copies | **15**, une par stagiaire du groupe |
| Les questions par copie | **24** : 10 QCM et 14 questions à rédiger (cas pratiques, persona, journey map, roadmap…) |
| Au total | **360** questions, dont **210** à juger |
| Les commentaires | une justification rédigée sur **chacune** des 360 questions |
| La publication | les 15 résultats, **tous publiés le 15/10** |

Un seul contrôle, quinze stagiaires, et la correction entière — relecture,
suggestions IA, validation et publication — faite le jeudi 15.

**Ce que dit le graphique Vercel** (lecture des barres, à quelques secondes
près ; le 15 est donné exactement par l'infobulle) :

| Jour | Function | Middleware | Total | Ce qui s'est passé |
| --- | --- | --- | --- | --- |
| Mardi 13 | ≈ 3 min 40 | ≈ 55 s | ≈ 4 min 35 | jour de cours |
| Mercredi 14 | ≈ 4 min 45 | ≈ 50 s | ≈ 5 min 35 | **l'épreuve** : 4 h de composition, 15 remises notées par l'IA |
| **Jeudi 15** | **11 min 11** | **1 min 43** | **12 min 54** | **la correction** |
| Vendredi 16 | ≈ 3 min 35 | ≈ 40 s | ≈ 4 min 15 | jour de cours |

Trois choses à en tirer.

**1. La cause est confirmée.** Le 13 et le 16 encadrent le 15 au même niveau,
autour de 4 minutes. Le 15 en fait trois fois plus, et c'est le jour où les
quinze copies ont été corrigées et publiées.

**2. L'épreuve elle-même n'a presque rien coûté.** Le 14, quatre heures de
composition pour quinze stagiaires, **plus quinze corrections automatiques
complètes par l'IA** à la remise : à peine **une minute** de plus qu'un jour
de cours. Le brouillon et la surveillance écrivent directement dans Supabase
sans passer par Vercel, et chaque remise ne fait **qu'un appel à l'IA** pour
toute la copie.

**3. Le middleware a doublé le 15** — 1 min 43 au lieu d'environ 50 s. Le
proxy ne tourne que sur les vraies requêtes de pages et les Server Actions,
jamais sur `/api/` (§8). Ce doublement dit donc que **le nombre de pages
rendues** a explosé ce jour-là, pas le nombre d'appels à l'IA. C'est
exactement la signature du rechargement complet à chaque « Valider et
continuer » (§10.2).

**Autre chose d'inhabituel le 15 ?** Rien dans ce qu'on peut voir : le 13 et
le 16 sont des jours de cours ordinaires, et le seul évènement de la semaine
— l'épreuve — tombe le 14 et coûte peu. La requête A de la §10.6 permettrait
de l'exclure tout à fait (générations de supports, quiz, annonces).

### 10.2 Le chemin d'une correction, du clic à l'enregistrement

Il y a **deux correcteurs IA différents** dans le projet, et il faut les
distinguer.

**a) La correction automatique, à la remise.** Quand un stagiaire rend sa
copie (`app/api/controle/passer/route.ts`), le serveur la note tout de suite
(`lib/notation.ts`) :

- les QCM sont notés **sans IA**, par comparaison exacte ;
- toutes les autres questions partent **dans un seul appel** à l'IA, pour
  toute la copie ;
- lu en base avant l'appel : la fiche du stagiaire, le contrôle, la copie
  déjà rendue (pour refuser un doublon), **toutes les questions avec leur
  corrigé et leurs données**, le formateur du groupe, puis votre clé et vos
  réglages (`lire_cle_llm`, déchiffrée dans Vault) ;
- après l'appel : analyse du JSON, bornage des points, puis enregistrement
  par `enregistrer_passation`, qui recalcule la note en base.

Ça, c'est **un appel par copie**, et c'est le stagiaire qui le déclenche — pas
vous.

**b) Le correcteur de l'écran de correction — ce que vous avez utilisé le
15.** Écran `/modules/[id]/controle/correction`, bouton « Proposer une
correction avec l'IA » (`CorrectionManager.tsx` → `app/api/corrige/route.ts`) :

| Étape | Ce qui se passe | Où |
| --- | --- | --- |
| Clic « Proposer » | **un appel par question**, pas par copie | navigateur → `/api/corrige` |
| Avant l'appel | 1 lecture de la question (énoncé, barème, corrigé), la session, puis votre clé déchiffrée — **relue à chaque question** | serveur |
| Préparation | le texte du prompt ; un schéma dessiné est converti en description (`pourCorrection`) | serveur, quelques millisecondes |
| L'appel | Claude en flux, avec réflexion adaptative ; le serveur **attend** | serveur, attente |
| Après | analyse du JSON, bornage des points. **Rien n'est enregistré** : la suggestion revient à l'écran | serveur, négligeable |
| « Appliquer la suggestion » | ne touche que l'écran | navigateur, **gratuit** |
| « Valider et continuer » | enregistre **la copie entière**, recalcule la note, puis **recharge toute la page** | serveur |
| Passer à la copie suivante | change seulement ce qui est affiché | navigateur, **gratuit** |

Le support de cours n'est **pas** lu : ni ici, ni à la remise. Le prompt
contient l'énoncé, le barème, le corrigé et la réponse — rien d'autre.

**Le point important est la ligne « Valider et continuer ».** Elle se clique
**à chaque question**, et à chaque fois :

1. la Server Action `corrigerPassation` enregistre toute la copie, puis
   appelle `revalidatePath("/modules")` ;
2. le navigateur appelle `router.refresh()`, qui fait **refaire tout le rendu
   de la page côté serveur** :
   - le gabarit formateur — ses 13 à 14 lectures, dont 9 pour la cloche
     (§9.1, point 2) ;
   - `getModules()` : **tous** les modules, plus l'année et ses groupes, pour
     n'en garder qu'un ;
   - `getControles()` : tous les contrôles du groupe pour ce module, avec les
     barèmes de leurs questions ;
   - `getPassations()` : **toutes les copies du contrôle, avec leurs réponses
     entières** — et chaque réponse transporte aussi l'énoncé et le corrigé de
     sa question. Pour vingt copies, l'énoncé et le corrigé de chaque question
     sont relus et renvoyés **vingt fois**.

Le code dit lui-même que ce n'était pas l'intention : « la correction se
travaille en local, puis s'enregistre d'un bloc ». En pratique, le bouton
enregistre **et recharge tout** à chaque question.

Il est probable que `revalidatePath` dans l'action déclenche déjà un nouveau
rendu, et que `router.refresh()` en refasse un second. À vérifier dans
Vercel : si chaque clic « Valider et continuer » montre deux exécutions de la
page, c'est le cas.

**Corriger plusieurs copies d'un coup : il n'y a pas de correction en lot.**
L'écran passe d'une copie à l'autre sans appeler le serveur ; chaque question
demande son propre clic. Ce qui est **refait pour chaque question** alors
qu'une seule fois suffirait :

| Refait à chaque question | Utile une fois par |
| --- | --- |
| Votre clé déchiffrée et vos réglages (`lire_cle_llm`) | séance de correction |
| La vérification de session | requête — normal |
| Toutes les copies du contrôle, réponses entières | ouverture de l'écran |
| Tous les modules, l'année, les contrôles | ouverture de l'écran |
| Le gabarit et ses 9 lectures pour la cloche | navigation |

Côté remise automatique, même remarque à plus petite échelle : chaque copie
relit les questions et la clé. Mais chaque copie arrive à un moment différent,
dans une exécution différente : il n'y a rien à mettre en commun.

### 10.3 Ce que coûte une correction

**D'abord, ce qui ne coûte presque rien : l'attente de l'IA.** Vercel facture
le CPU **actif**. Pendant les 5 à 30 secondes où la fonction attend la réponse
de Claude, elle ne calcule pas, et le compteur ne tourne pas. Ce qui compte,
c'est le travail fait avant et après — et le rechargement de page.

**Estimation par opération**, à partir du code et des ordres de grandeur
habituels de Next.js sur Vercel (non mesurés ici) :

| Opération | CPU actif estimé |
| --- | --- |
| Une suggestion IA (`/api/corrige`) : flux analysé, JSON, trois lectures | 0,05 à 0,15 s |
| « Valider et continuer » : l'action d'enregistrement | 0,03 à 0,05 s |
| … puis le rechargement complet de la page (un ou deux rendus) | 0,15 à 0,8 s |
| Démarrage à froid d'une fonction (quand elle dormait) | 0,2 à 0,5 s, de temps en temps |
| **Une question corrigée avec l'IA** | **≈ 0,3 à 1 s** |

**Le rechargement pèse trois à huit fois plus que l'appel à l'IA.**

| Échelle | Calcul | CPU actif |
| --- | --- | --- |
| Une copie, 5 questions ouvertes | 5 × 0,3 à 1 s | **≈ 1,5 à 5 s** |
| Un contrôle, groupe de 20 | 20 × 1,5 à 5 s | **≈ 0,5 à 1,7 min** |
| Le même contrôle, rendu le jour même | + 20 remises notées automatiquement, ≈ 0,1 à 0,3 s chacune | + quelques secondes |

Et le coût du rechargement **grandit avec le nombre de copies** : la page
relit toutes les copies à chaque clic. Corriger la vingtième copie coûte plus
cher que la première.

**Recaler sur le 15 octobre.** Le surplus « function » du jour, par rapport
à la moyenne du 13 et du 16, est d'environ **7 min 30, soit 450 s**.

| Si vous avez validé… | Clics | CPU par question validée |
| --- | --- | --- |
| les 24 questions de chaque copie | 360 | **≈ 1,25 s** |
| seulement les 14 questions à rédiger | 210 | **≈ 2,1 s** |

**C'est plus que mon estimation de départ (0,3 à 1 s).** L'écart s'explique
par le poids de cet EFM : 24 questions, dont des cas pratiques avec données
fournies et réponses longues. Chaque rechargement renvoyait **les 15 copies
entières**, et dans chacune l'énoncé, les données et le corrigé des 24
questions — soit 360 énoncés et 360 corrigés relus et sérialisés **à chaque
clic**, pour n'en afficher qu'un.

**Ce qu'a coûté ce contrôle :**

| | CPU actif |
| --- | --- |
| Une copie corrigée (24 questions) | **≈ 30 s** |
| Le contrôle entier, 15 copies | **≈ 7 min 30** |
| Le même, notation automatique à la remise | ≈ 1 min, et c'était tout l'examen du 14 compris |

**Pour un groupe de 20.** Il y a plus de clics *et* chaque clic relit plus de
copies : le coût croît plus vite que le nombre de stagiaires. Pour un EFM du
même format : **≈ 10 à 13 minutes**. Pour un contrôle continu plus court,
une dizaine de questions : **≈ 2 à 4 minutes**.

**En période d'examens.** Hypothèse : quatre groupes d'une vingtaine de
stagiaires, un EFM chacun dans la même semaine, corrigés comme le 15 :

| | Calcul | CPU actif |
| --- | --- | --- |
| La semaine de correction | 4 × 10 à 13 min | **≈ 40 à 50 min** |
| Rapporté au quota de 240 min sur 30 jours | | **≈ 17 à 22 %** |
| Avec deux EFM par groupe | | **≈ 35 à 45 %** |

Avec un quota déjà à 84 % (§9.0), **une seule semaine d'examens comme
celle-ci suffit à le dépasser.**

### 10.4 Ce qu'on peut alléger sans toucher à la correction

Rien ci-dessous ne change le prompt, le modèle, la réflexion, ni la note
produite. Seul le chemin autour change.

| # | Quoi | Gain | Risque | Temps |
| --- | --- | --- | --- | --- |
| 1 | **Ne plus recharger la page à chaque question.** Garder l'enregistrement, retirer le `router.refresh()`, et mettre à jour la copie dans la liste de l'écran | **fort** — la plus grosse part du coût | faible à moyen | 1 h |
| 2 | Retirer le `revalidatePath("/modules")` de `corrigerPassation`, ou le viser juste | moyen — **seulement si** le double rendu est confirmé | faible | 15 min |
| 3 | La page de correction ne lit que **la liste** des copies (nom, note, photo) ; les réponses de la copie ouverte se lisent à l'ouverture | moyen, et grandit avec la taille des groupes | moyen | 2 h |
| 4 | Alléger la cloche du gabarit formateur (point 4 du §9.9, déjà prévu) | moyen ici, fort partout | moyen | 2 à 3 h |
| 5 | Lire **un** module au lieu de tous dans `correction/page.tsx` | faible | nul | 15 min |
| 6 | Ne pas relire la clé déchiffrée à chaque question | **très faible** : c'est de l'attente réseau, pas du calcul | faible | 30 min |

**Le risque du numéro 1, précisément.** Aujourd'hui, la liste des copies de
l'écran vient du serveur et ne se rafraîchit qu'au rechargement. Si on retire
le rechargement sans rien d'autre, revenir sur une copie déjà corrigée
**afficherait l'ancienne version** — et un nouvel enregistrement écraserait la
bonne. Il faut donc que l'écran garde lui-même la dernière version de chaque
copie enregistrée. C'est ce qui fait passer le risque de « nul » à « faible à
moyen », et c'est le point à tester avant de fusionner.

**Ce qui n'est pas à alléger :** l'appel à l'IA lui-même. Le flux est
nécessaire (§9.8), la réflexion adaptative sert la qualité, et l'attente n'est
pas facturée en CPU.

### 10.5 Faut-il changer quelque chose ?

**L'appel à l'IA : non. Son coût est normal, et petit.** La preuve est le 14 :
quinze copies entières notées par l'IA, pour une minute de plus qu'un jour de
cours. L'attente de la réponse n'est pas facturée en CPU.

**Le rechargement à chaque question : oui. Ce coût n'est pas acceptable.**
Il ne sert à rien — l'écran a déjà tout ce qu'il affiche — et il fait payer
une correction **sept fois plus cher que l'examen lui-même**. Un seul
contrôle a coûté le 15 l'équivalent de deux jours de cours. En juin, avec
plusieurs groupes, il fera sauter le quota.

**Mon avis :** faire le **numéro 1** de la §10.4 avant la prochaine
correction d'EFM. Une heure de travail. L'action d'enregistrement reste (une
fraction de seconde par clic), le rechargement disparaît : la correction
d'un contrôle comme celui du 15 devrait passer de **≈ 7 min 30 à moins d'une
minute**. Puis le **numéro 3**, qui empêche le coût de grandir avec la taille
du groupe. Le reste peut attendre.

Ne rien changer n'est pas une option raisonnable ici : le chiffre du 15 n'est
pas un accident, c'est ce que coûtera **chaque** correction d'EFM.

### 10.6 Les requêtes à lancer

Toutes en lecture seule. Heure du Maroc (`Africa/Casablanca`), pour
correspondre au tableau de bord Vercel. À coller dans Supabase → SQL Editor.

**A. Les trois jours côte à côte**

```sql
with jours(j) as (
  values (date '2026-10-13'), (date '2026-10-15'), (date '2026-10-16')
),
corr as (
  select (a.date at time zone 'Africa/Casablanca')::date as j,
         a.ligne_id, p.controle_id, p.stagiaire_id
  from audit_log a
  join passations_controle p on p.id = a.ligne_id
  where a.table_name = 'passations_controle'
    and a.date >= '2026-10-12' and a.date < '2026-10-18'
)
select
  jours.j as jour,
  (select count(*)                     from corr where corr.j = jours.j) as enregistrements_correction,
  (select count(distinct ligne_id)     from corr where corr.j = jours.j) as copies_corrigees,
  (select count(distinct controle_id)  from corr where corr.j = jours.j) as controles_corriges,
  (select count(distinct stagiaire_id) from corr where corr.j = jours.j) as stagiaires_corriges,
  (select count(*) from passations_controle p
     where (p.submitted_at at time zone 'Africa/Casablanca')::date = jours.j) as copies_rendues,
  (select count(*) from surveillance_evenements s
     where (s.cree_le at time zone 'Africa/Casablanca')::date = jours.j) as evenements_surveillance,
  (select count(*) from analyses_controle x
     where (x.created_at at time zone 'Africa/Casablanca')::date = jours.j) as analyses_ia,
  (select count(*) from supports_seance x
     where (x.created_at at time zone 'Africa/Casablanca')::date = jours.j) as supports_generes,
  (select count(*) from fiches_preparation x
     where (x.created_at at time zone 'Africa/Casablanca')::date = jours.j) as fiches,
  (select count(*) from controles x
     where (x.created_at at time zone 'Africa/Casablanca')::date = jours.j) as controles_crees,
  (select count(*) from quiz_chapitre x
     where (x.genere_le at time zone 'Africa/Casablanca')::date = jours.j) as quiz_generes,
  (select count(*) from annonces x
     where (x.created_at at time zone 'Africa/Casablanca')::date = jours.j) as annonces,
  (select count(*) from commentaires_annonce x
     where (x.created_at at time zone 'Africa/Casablanca')::date = jours.j) as commentaires
from jours
order by jours.j;
```

**B. Le détail du 15 : copie par copie**

```sql
select c.titre as controle,
       p.nom_complet,
       count(a.id) as enregistrements,
       to_char(min(a.date) at time zone 'Africa/Casablanca', 'HH24:MI') as debut,
       to_char(max(a.date) at time zone 'Africa/Casablanca', 'HH24:MI') as fin,
       jsonb_array_length(p.responses) as questions,
       pg_size_pretty(length(p.responses::text)::bigint) as taille_copie
from audit_log a
join passations_controle p on p.id = a.ligne_id
join controles c on c.id = p.controle_id
where a.table_name = 'passations_controle'
  and (a.date at time zone 'Africa/Casablanca')::date = '2026-10-15'
group by c.titre, p.id, p.nom_complet, p.responses
order by min(a.date);
```

**C. Ce que chaque clic faisait relire, et combien de commentaires ont changé**

```sql
-- Le poids de « toutes les copies » relues à chaque rechargement.
select c.titre,
       count(*) as copies,
       pg_size_pretty(sum(length(p.responses::text))::bigint) as poids_relu_par_clic
from passations_controle p
join controles c on c.id = p.controle_id
where p.controle_id in (
  select p2.controle_id
  from audit_log a
  join passations_controle p2 on p2.id = a.ligne_id
  where a.table_name = 'passations_controle'
    and (a.date at time zone 'Africa/Casablanca')::date = '2026-10-15'
)
group by c.titre;

-- Questions dont le commentaire ou les points ont changé le 15 :
-- à peu près le nombre de suggestions IA appliquées (plus les retouches à la main).
select count(*) filter (where n.e->>'commentaire' is distinct from o.e->>'commentaire') as commentaires_changes,
       count(*) filter (where n.e->>'points'      is distinct from o.e->>'points')      as points_changes
from audit_log a
cross join lateral jsonb_array_elements(a.nouvelle_valeur->'responses') with ordinality as n(e, i)
join lateral jsonb_array_elements(a.ancienne_valeur->'responses') with ordinality as o(e, i)
  on o.i = n.i
where a.table_name = 'passations_controle'
  and (a.date at time zone 'Africa/Casablanca')::date = '2026-10-15';
```

**Et dans Vercel**, sur le plan Hobby, le détail par fonction n'existe pas.
Ce qu'on peut faire : Usage → Fluid Active CPU → onglet **Type**, et comparer
les jours. Après la correction 1, une journée de correction d'EFM doit
ressembler à un jour de cours ordinaire, avec un middleware qui ne double plus.

### 10.7 Corrections appliquées — branche `perf-correction`

Les corrections 1 et 2 de la §10.4. Deux commits, pas poussés. **Rien n'a
changé dans l'appel à l'IA** : ni le prompt, ni le modèle, ni la réflexion,
ni le calcul de la note.

#### La correction 2 : le double rendu, mesuré

Vous l'aviez demandée seulement si le double rendu se confirmait en local.
Il se confirme, et il change le plan : **la correction 1 seule n'aurait
retiré que la moitié du coût.**

Mesuré sur une build de production lancée en local, avec une page d'essai
temporaire (retirée depuis) qui écrit une ligne à chaque rendu côté serveur :

| Ce que fait le clic | Rendus de la page |
| --- | --- |
| `revalidatePath` + `router.refresh()` — **le code d'avant** | **2** |
| `revalidatePath` seul, même sur un chemin sans rapport avec la page | 1 |
| `router.refresh()` seul | 1 |
| ni l'un ni l'autre — **le code d'après** | **0** |

La documentation de Next 16 le dit aussi : une Server Action qui appelle
`revalidatePath` refait le rendu de la page courante **dans sa propre
réponse**. `router.refresh()` en refaisait ensuite un second. Chaque « Valider
et continuer » coûtait donc **deux** rendus complets — gabarit, cloche, toutes
les copies.

#### Ce qui a changé

**Commit 1 — l'écran ne relit plus la page.** `router.refresh()` est retiré.
L'écran tient lui-même la dernière version enregistrée de chaque copie, et ne
l'avance **que lorsque la base a confirmé l'enregistrement**. Passer d'une
copie à l'autre puis revenir montre donc ce qui a été enregistré, pas ce que
la page avait chargé à l'ouverture.

**Commit 2 — l'enregistrement ne refait plus le rendu.** `revalidatePath`
est retiré de `corrigerPassation`. Rien n'en dépendait : la page `/modules`
n'affiche aucune note, et la liste des copies relit les siennes à
l'ouverture.

#### Une version périmée ne peut plus en écraser une plus récente

C'était le point le plus important de la demande, et le risque que la §10.4
signalait.

Sans rechargement, l'écran peut tenir une version en retard dans deux cas : un
**second onglet** ouvert sur la même copie, ou une page **restaurée par le
bouton « précédent »** du navigateur — Next réutilise alors la page gardée en
mémoire, avec les copies telles qu'elles étaient.

À chaque enregistrement, l'écran envoie donc **la version qu'il croit être en
base**. Le serveur relit la copie et compare. Si elles diffèrent, il
**refuse**, n'enregistre rien, et l'écran l'affiche :

> Cette copie a été modifiée ailleurs depuis que vous l'avez ouverte.
> Rechargez la page pour reprendre la dernière version : rien n'a été
> enregistré.

La comparaison ignore l'ordre des champs, que la base réordonne à
l'écriture. Elle a été vérifiée hors navigateur sur sept cas : même version
avec champs dans un autre ordre (acceptée) ; points changés, commentaire
changé, question en plus, `null` contre `0`, copie vide (refusés).

**Ce que coûte la garde :** une lecture d'une seule copie par
enregistrement. C'est de l'attente réseau, pas du calcul, et c'est beaucoup
moins que les deux rendus complets qu'elle remplace.

**Sa limite, honnêtement :** la relecture et l'écriture sont deux requêtes.
Deux onglets qui enregistreraient la même copie **dans la même fraction de
seconde** pourraient passer tous les deux. Pour un formateur seul, ce cas ne
se produit pas. Le fermer tout à fait demanderait que la fonction
`corriger_passation` fasse elle-même la comparaison, donc une migration à
appliquer en production — je ne l'ai pas faite sans votre accord.

**Ce qui ne change pas :** une question modifiée puis abandonnée sans
« Valider et continuer » est perdue quand on change de copie. C'était déjà le
cas avant.

#### Ce que ça devrait donner

| | Avant | Après |
| --- | --- | --- |
| Rendus de page par « Valider et continuer » | 2 | **0** |
| Ce que fait le serveur à chaque clic | enregistrer + 2 rendus complets | relire une copie + enregistrer |
| Un EFM comme celui du 15 (15 copies, 24 questions) | ≈ 7 min 30 | **moins d'une minute**, estimé |

L'estimation se vérifiera à la prochaine correction d'EFM : Usage → Fluid
Active CPU → onglet Type. Le jour de correction doit ressembler à un jour de
cours, avec un middleware qui ne double plus.

#### Ce qui a été vérifié, et ce qui ne l'a pas été

Vérifié : `git pull` sur `main` (déjà à jour) ; le double rendu, mesuré
(ci-dessus) ; la comparaison de versions, sept cas ; `tsc --noEmit`,
`verifie-actions` et `verifie-stage` passent ; `npm run build` passe ; la
build de production démarre, et l'écran de correction renvoie bien vers la
connexion sans session.

**Pas vérifié : l'écran de correction lui-même.** Cette machine n'a pas les
clés Supabase (aucun fichier `.env`) : la build a tourné avec une adresse
factice, donc sans base et sans connexion possible. Et `verifie:markdown` et
`verifie:cahier` n'ont pas tourné : ils demandent Node 22, cette machine a
Node 20. Ils ne touchent à rien de ce qui a changé ici.

#### À vérifier vous-même avant de fusionner

En local, avec votre `.env.local`, sur une build de production :

```bash
npm run build && npx next start -p 3002
```

Sur un contrôle de test, avec la copie de votre compte de test — pas sur un
vrai EFM : chaque enregistrement écrit dans la base de production.

1. **Les corrections survivent au changement de copie.** Corriger deux
   questions de la copie A (« Valider et continuer » à chaque fois), passer à
   la copie B, revenir à A : les deux corrections sont là, notes et
   commentaires.
2. **Rien ne se perd au second passage.** Sur la copie A, modifier encore une
   des deux questions, valider : les trois états sont bons — la question
   retouchée a sa nouvelle note, l'autre garde la sienne.
3. **La base a tout.** Recharger la page (F5) : la copie A montre exactement
   ce qu'on voyait avant le rechargement.
4. **La note totale est juste.** La « note provisoire » en haut et le nombre
   dans la liste déroulante des copies valent la somme des points des
   questions, avant comme après F5.
5. **La publication marche.** Toutes les questions corrigées : « Publier le
   résultat » ; le stagiaire de test voit sa note dans son espace. Puis
   « Retirer la publication ».
6. **Une version périmée est refusée.** Ouvrir la même copie dans **deux
   onglets**. Dans le premier, corriger une question et valider. Dans le
   second, sans recharger, corriger une autre question et valider : le
   message « Cette copie a été modifiée ailleurs… » doit apparaître, et après
   F5 la correction du premier onglet doit être intacte.
7. **Le bouton « précédent ».** Corriger une question, aller sur la liste des
   copies par le fil d'Ariane, revenir avec « précédent » du navigateur, puis
   valider une autre question : soit tout est à jour, soit le même message de
   refus apparaît. **Jamais** la correction d'avant ne doit disparaître.
8. **Plus de rechargement.** Outils de développement → Réseau, puis
   « Valider et continuer » : une seule requête part (le POST de l'action),
   sans requête `?_rsc=` derrière, et la réponse est petite — quelques
   centaines d'octets, pas des centaines de kilo-octets.
9. **La suggestion IA est intacte.** « Proposer une correction avec l'IA »,
   puis « Appliquer la suggestion », puis valider : la note et le commentaire
   proposés s'enregistrent comme avant.
