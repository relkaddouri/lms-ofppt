# BACKLOG.md — Pédago, backlog atomique v2

**Ce fichier remplace intégralement l'ancien backlog.** Il est construit strictement à partir de `docs/PRD.md` v2 — ne pas réutiliser ou consulter un ancien BACKLOG.md, ses atomes ne correspondent plus au produit cible.

Convention inchangée : chaque atome = un prompt exact à donner à l'agent + un test qui valide avant de passer au suivant. Tout atome touchant une interface commence par *"En respectant strictement docs/design_system.md et docs/conventions.md (ne rien improviser en dehors) : "*. Coche les cases au fur et à mesure, commit après chaque atome validé.

Ordre des phases : sécurité et fondations d'abord, schéma du référentiel officiel ensuite, granularité opérationnelle, puis interfaces formateur et stagiaire, enfin les fonctionnalités périphériques et le déploiement. Ne pas construire d'interface sur un modèle de données qui va encore changer.

---

## Phase 0 — Assainissement (préalable obligatoire, débloque tout le reste)

- [x] **0.1** — Prompt : *"Crée la migration `011_security_hardening.sql` : (1) supprime la policy `passations_insert_anon` sur `passations_controle` et remplace-la par une fonction `security definer` `submit_passation(p_token uuid, p_responses jsonb)` qui recalcule la note côté base et insère elle-même la ligne ; (2) révoque le `grant execute to anon` sur `get_questions_with_corrige_for_scoring`, cette fonction ne doit être appelable que par la route serveur avec une clé service role ; (3) supprime la policy `audit_log_insert_auth` (le trigger security definer suffit) ; (4) remplace toutes les policies `using (true) with check (true)` sur les tables métier par des policies restreintes au propriétaire réel (`formateur_id = auth.uid()` une fois la colonne ajoutée en Phase 1, sinon prépare la structure)."*
  **Test** : tente d'insérer une passation avec une note arbitraire via un appel direct Supabase (pas via l'API) — doit échouer. Passation normale via l'interface doit toujours fonctionner.
- [x] **0.2** — Prompt : *"Ajoute une limite de débit basique sur `/api/controle/submit` (quelques requêtes par minute par token ou par IP)."*
  **Test** : appelle la route en boucle rapide, vérifie qu'elle se bloque après le seuil.
- [x] **0.3 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : crée les composants partagés `components/ui/Button.tsx`, `Input.tsx`, `Card.tsx`, `Modal.tsx`, `Toast.tsx`, `Badge.tsx` conformes au design system (couleurs, tailles, comportements décrits dans le fichier). Crée aussi `lib/format.ts` avec les fonctions utilitaires uniques `formatDate`, `initials`, `slugify`."*
  **Test** : les composants s'affichent correctement dans une page de démonstration temporaire.
- [x] **0.4** — Prompt : *"Remplace tous les `alert()` et `confirm()` natifs du projet par les composants `Toast` et `Modal` de confirmation créés en 0.3. Remplace toutes les occurrences locales de `inputClass`/`btnPrimary`/`formatDate`/`initials` par les composants et fonctions partagés."*
  **Test** : grep sur `alert(` et `confirm(` dans le projet — zéro résultat en dehors de commentaires.
- [x] **0.5 — Interface** — Prompt : *"Crée `app/(protected)/groupes/[id]/layout.tsx` qui charge le groupe une seule fois (`getGroupeById`, `getStagiairesCount`) et affiche `GroupeHeader` + `GroupeTabs`, partagé par toutes les sous-pages de `/groupes/[id]/*`. Supprime le chargement dupliqué dans chaque sous-page."*
  **Test** : navigue entre les onglets d'un groupe, vérifie qu'il n'y a pas de rechargement visible du header.

---

## Phase 1 — Fondation du référentiel officiel (Programme → Compétence → Fiche prescrite → Suggestions pédagogiques)

- [x] **1.1** — Prompt : *"Crée la migration `012_referentiel_officiel.sql` : tables `specialites` (id, nom, code, duree_totale_heures), `programmes` (id, specialite_id, annee_approbation), `competences` (id, programme_id, numero 1-16, code_officiel ex. DIA_DESOUX_TS-06, code_operationnel ex. M106, nom, duree_nationale_heures, type text competences_preferable/parallele en texte libre pour l'instant). Ajoute les policies RLS lecture pour authentifié."*
  **Test** : insère la spécialité UX Designer et ses 16 compétences (données réelles du programme fourni), vérifie les contraintes de numéro unique par programme.
- [x] **1.2** — Prompt : *"Crée la migration `013_fiches_prescrites.sql` : table `fiches_prescrites` (id, competence_id unique, contexte_realisation text, criteres_generaux_performance text), table `elements_competence` (id, fiche_prescrite_id, lettre A/B/C, intitule, ordre), table `criteres_particuliers_performance` (id, element_competence_id, texte, ordre)."*
  **Test** : saisis la fiche prescrite complète de la compétence 6 (exemple fourni dans le programme), vérifie l'affichage hiérarchique dans Supabase.
- [x] **1.3** — Prompt : *"Crée la migration `014_suggestions_pedagogiques.sql` : table `suggestions_pedagogiques` (id, element_competence_id, apprentissage_base text, elements_contenu text, activites_apprentissage text, duree_suggeree_pourcent numeric)."*
  **Test** : saisis les suggestions pédagogiques de l'élément A de la compétence 6, vérifie la cohérence des pourcentages (somme ≈ 100% par élément).
- [x] **1.4** — Prompt : *"Crée un script ou une interface d'import semi-automatique du programme de formation depuis un document Word structuré (parsing des blocs 'Compétence N', 'Code', 'Durée', tableaux de suggestions pédagogiques), avec relecture humaine de contrôle avant sauvegarde définitive — ne pas insérer directement en base sans validation."*
  **Test** : importe le programme UX Designer complet, vérifie que les 16 compétences et leurs fiches prescrites sont correctement extraites, avec une étape de relecture avant validation finale.
- [x] **1.5** — Prompt : *"Migre la table `modules` existante : renomme conceptuellement en gardant la table (elle sert de pont opérationnel), ajoute `competence_id` (référence vers `competences`), garde `duree_heures` mais renomme-la en `duree_reference` avec un commentaire clarifiant que c'est indicatif, pas la masse horaire réelle par groupe."*
  **Test** : vérifie que les modules existants (M104, M106) sont bien liés à leurs compétences correspondantes après migration manuelle des données.
- [x] **1.6** — Prompt : *"Ajoute à `groupe_modules` les colonnes `masse_horaire_allouee` (numeric, obligatoire) et `formateur_id` (référence vers profils). Ajoute à `groupes` les colonnes `annee` (1 ou 2) et `specialite_id` (nullable, requis seulement si année 2)."*
  **Test** : réassigne M106 à DES101 avec 110h et à DES102 avec 85h (données réelles), vérifie que les deux valeurs coexistent indépendamment.
- [x] **1.7 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : sur l'écran d'assignation des modules à un groupe (probablement `GroupModulesList` ou équivalent existant), ajoute un champ de saisie de la masse horaire allouée pour chaque module assigné à ce groupe — modifiable à tout moment après l'assignation initiale, pas seulement à la création. Affiche la masse horaire actuelle à côté de chaque module dans la liste, avec une action rapide pour la modifier (inline ou modale)."*
  **Test** : modifie la masse horaire de M106 pour DES101 de 110h à 115h depuis l'interface (pas en SQL direct), vérifie que le changement est bien pris en compte dans le calcul de progression (§2.2) sans casser la valeur de DES102.
- [x] **1.8 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : sur l'écran de consultation d'une compétence/module (celui créé en 3.2 pour le référentiel, ou à défaut la page Modules existante), rends `duree_reference` éditable par le formateur — ce n'est qu'un repère national indicatif, pas une valeur figée, il doit pouvoir l'ajuster à sa réalité. Affiche un texte discret rappelant que c'est une référence nationale de guidage, modifiable localement."*
  **Test** : modifie la durée de référence de M106 (ex. 120h → 118h), vérifie que ça n'affecte ni ne casse les masses horaires déjà allouées par groupe (1.7), qui restent des valeurs indépendantes.
- [x] **1.9** — Prompt : *"Durcis la RLS pour de bon. Les trois fonctions pivot de la migration 011 (`peut_acceder_groupe`, `peut_acceder_module`, `peut_acceder_controle`) renvoient encore « tout utilisateur authentifié » : branche-les sur `formateur_id = auth.uid()`. Attention, un rattachement uniquement via `groupe_modules` rendrait invisible un groupe sans module assigné, et empêcherait la création d'un groupe (aucune assignation n'existe encore au moment de l'insertion) : ajoute une colonne de propriété directe sur `groupes` et `modules`, avec `default auth.uid()`, et reprends les lignes existantes. Vérifie que la création de groupe et de module continue de fonctionner."*
  **Test** : sous le rôle `authenticated` avec l'identifiant du formateur réel, toutes les données restent visibles ; avec un identifiant d'un autre formateur, les groupes, modules, contrôles, stagiaires, séances et annonces ne sont plus visibles du tout. Créer un groupe puis un module depuis l'interface doit toujours fonctionner et rester visible pour son créateur.
- [x] **1.10** — Prompt : *"Ajoute les frontières d'erreur manquantes, conformément à docs/conventions.md L.39 : aucune erreur technique brute ne doit être montrée à l'utilisateur. Crée `app/error.tsx` et `app/(protected)/error.tsx` avec un message clair, une action de reprise, et la journalisation de l'erreur côté console. Ajoute aussi `app/not-found.tsx`. Respecte docs/design_system.md."*
  **Test** : provoque une erreur de rendu dans une page protégée (ex. coupure de la base), vérifie qu'un message lisible s'affiche avec un bouton de reprise, et non une stack trace.

---

## Phase 2 — Granularité opérationnelle (séances, heures, contrôles rattachés au bon niveau)

- [x] **2.1** — Prompt : *"Ajoute à `seances` les colonnes `heure_debut`, `heure_fin` (time), `mode` (présentiel/distance), `objectif_operationnel` (text), `duree_realisee` (numeric, nullable), `a_prevoir_prochaine_seance` (text, nullable). Réécris complètement `createSeancesForGroupe` : elle doit permettre de créer une nouvelle séance à tout moment (pas seulement une fois par module), avec sélection du bloc horaire (matin 8h30-13h30 ou soir 13h30-18h30, avec possibilité de scinder en deux sous-créneaux), pas une génération automatique unique bloquée après le premier appel."*
  **Test** : crée trois séances successives sur le même couple groupe+module à des dates différentes, vérifie qu'aucune n'écrase la précédente.
- [x] **2.2** — Prompt : *"Crée une vue ou une fonction SQL qui calcule le cumul d'heures réalisées par couple groupe+module, à partir de la somme des `duree_realisee` des séances au statut 'fait'. Modifie `RailDeProgression` pour afficher ce cumul en heures (ex. '72h / 110h') plutôt qu'un simple pourcentage de séances cochées."*
  **Test** : marque 3 séances de durées différentes comme réalisées, vérifie que le cumul affiché correspond à la somme exacte.
- [x] **2.3** — Prompt : *"Ajoute à `controles` les colonnes `groupe_id` (obligatoire, référence groupes), `type` (CC/EFM), `type_efm` (local/régional, nullable si type=CC), `date_prevue` (nullable), `date_administration` (nullable), `format` (théorique/pratique/mixte). Modifie toutes les requêtes de génération et de préparation de contrôle pour filtrer par couple groupe+module, jamais par module seul."*
  **Test** : crée un contrôle pour DES101 sur M106, vérifie qu'il n'apparaît pas dans la liste des contrôles de DES102 sur ce même module.
- [x] **2.4** — Prompt : *"Crée la migration `015_fiches_operationnelles.sql` : renomme la table actuelle `fiches_preparation` en `fiches_prescrites_legacy` (à supprimer plus tard une fois la Phase 1 validée), crée une nouvelle table `fiches_preparation` avec `id, seance_id (référence unique vers seances), contenu text, version integer`. Une fiche de préparation est désormais rattachée à une séance précise, pas à un module."*
  **Test** : génère une fiche pour une séance de 2h30, vérifie qu'elle reste propre à cette séance et n'apparaît pas sur une autre séance du même module.

---

## Phase 2bis — Planification du module à partir du manuel de formateur

**C'est le cœur de l'application.** Le manuel de formateur OFPPT donne, pour chaque
compétence, la liste des objectifs d'apprentissage (A.1, A.2, B.1…) avec leurs éléments
théoriques et leur liste de TP — mais laisse **toutes les heures en « ? »**. Répartir sa
masse horaire réelle sur ces objectifs, en alterner théorie et pratique, placer les
contrôles et produire les fiches est le travail manuel que cette application doit reprendre.

- [x] **2b.0** — Prompt : *"Deux exports produisent encore une image rasterisée au lieu d'un PDF (`app/public/controle/[token]/ControlePublic.tsx` et `CopiesManager.tsx`, via `lib/pdf.ts`). Remplace-les par une génération vectorielle. Nomme tout PDF exporté d'après la séance ou le contrôle concerné, pas d'après le module."*

- [x] **2b.1** — Prompt : *"Le manuel de formateur n'est pas un document à importer : tout son contenu vient du programme officiel, déjà en base depuis la Phase 1 — les « apprentissages de base » de `suggestions_pedagogiques` SONT les objectifs d'apprentissage du manuel (A.1, A.2, B.1…). Ajoute seulement les champs manquants : énoncé de la compétence, description générale du cours, pourcentages théorique/pratique/évaluation sur `competences`, et les modes présentiel/synchrone/asynchrone sur `suggestions_pedagogiques`."*

- [x] **2b.1b** — Prompt : *"Génère le manuel de formateur d'une compétence en document téléchargeable, à la structure officielle : 1.1 informations générales (énoncé, description, contexte de réalisation, critères généraux, tableau éléments/critères particuliers), 1.2 suggestions pédagogiques (tableau à cinq colonnes), 2.1 stratégie pédagogique (texte générique commun à tous les modules), 2.2 plan de déroulement. La section 2.2 est la seule qui ne vient pas du référentiel : elle porte la répartition horaire calculée par l'atome 2b.2, là où le manuel officiel laisse « ? »."*

- [x] **2b.2** — Prompt : *"Crée la migration `repartition_horaire` (groupe_id, module_id, suggestion_pedagogique_id, heures_theoriques, heures_pratiques). À partir de la masse horaire allouée au couple groupe+module (atome 1.6) et des pourcentages du manuel, propose une répartition sur les objectifs, entièrement ajustable à la main. La somme doit retomber sur la masse horaire allouée, écart signalé."*

- [x] **2b.3** — Prompt : *"Ajoute à `seances` la colonne `suggestion_pedagogique_id` (obligatoire — c'est l'objectif d'apprentissage de la séance) et `nature` (théorique/pratique). Toute séance porte un objectif pédagogique : c'est lui qui fonde la fiche de préparation et le support."*

- [x] **2b.4** — Prompt : *"Génère le plan de séances d'un couple groupe+module à partir de la répartition horaire : découpe en séances selon les blocs horaires réels, alterne théorie et pratique, et insère un contrôle tous les 30 heures environ (seuil du PRD). Le plan est proposé, jamais appliqué sans validation du formateur."*

- [x] **2b.5 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : crée la page dédiée d'une séance. Elle réunit l'objectif pédagogique, la fiche de préparation directement éditable sur place (plus de recherche de fiche à part), la liste de présence des stagiaires, et les remarques de séance."*

- [x] **2b.6** — Prompt : *"Crée les tables `presences` (seance_id, stagiaire_id, present, motif) et `remarques_seance` (seance_id, texte, created_at), avec leurs policies restreintes au propriétaire, et l'interface de saisie depuis la page de séance."*

- [x] **2b.7** — Prompt : *"Génère le support de cours d'une séance à partir de son objectif d'apprentissage et de sa nature : un support théorique (notions, schémas, exemples) ou un énoncé de TP (contexte, consignes, livrable attendu, critères), selon le cas."*


---

## Phase 3 — Interface formateur (fiches, contrôles, calendrier, masse horaire)

- [x] **3.1** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : réécris le prompt système de `/api/generate/fiche-preparation` pour produire un aide-mémoire synthétique (mots-clés, idées clés, exemples, points de vigilance) — jamais un déroulé minuté détaillé. Contrains explicitement la longueur (ex. maximum 400 mots) pour éviter que le modèle déborde vers un texte développé. La génération doit s'appuyer sur la fiche prescrite et les suggestions pédagogiques de la compétence, le contenu déjà réalisé sur ce couple groupe+module, et la durée exacte de la séance."*
  **Test** : génère une fiche pour une séance de 2h30, vérifie que le résultat est un schéma court (mots-clés/exemples), pas un texte développé avec des blocs minutés.
- [x] **3.2 — Interface** — Prompt : *"Crée une vue de consultation du référentiel officiel (fiche prescrite + suggestions pédagogiques d'une compétence) en divulgation progressive : résumé court par défaut (nom, code, durée, objectif en une phrase), bouton 'Voir le détail complet' qui déplie le contexte de réalisation, critères de performance, éléments de compétence."*
  **Test** : ouvre la fiche de la compétence 6, vérifie que le résumé est visible immédiatement et que le détail ne s'affiche qu'au clic.
- [x] **3.3** — Prompt : *"Crée une fonction ou vue qui calcule, pour chaque couple groupe+module en cours, le rappel de contrôle à afficher (CC1/CC2/EFM) en fonction du cumul d'heures réalisées (2.2) rapporté à la masse horaire allouée (1.6) — seuil réactif à 30h sur un module de durée standard, proportionnel sur les modules plus courts. Ce rappel n'est qu'une notification affichée, il ne déclenche jamais de génération automatique."*
  **Test** : fais avancer un module fictif de faible durée totale (ex. 25h) jusqu'au seuil proportionnel attendu, vérifie que le rappel apparaît au bon moment.
- [x] **3.4 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : crée l'interface de préparation de contrôle en parcours guidé par étapes (indicateur 'Étape X sur 4') : (1) affichage du contenu couvert — partiel pour un CC (séances réalisées à date), complet pour un EFM (toutes les séances du module) ; (2) choix du format par le formateur (théorique/pratique/mixte) ; (3) assistance IA à la demande pour générer questions/barème/corrigé, tout éditable ; (4) relecture et validation finale."*
  **Test** : prépare un CC puis un EFM sur le même module, vérifie que le contenu de référence affiché diffère bien (partiel vs complet).
- [x] **3.5 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : crée la page `/calendrier` avec les blocs matin (8h30-13h30) et soir (13h30-18h30), pause interne visible en pointillés. Affiche les dates de contrôle CC1/CC2/EFM local en bordure pointillée (estimées), et permet la saisie manuelle de la date d'EFM régional (bordure pleine une fois saisie) avec les deux champs associés (date d'envoi des propositions, date de l'épreuve)."*
  **Test** : vérifie visuellement la distinction pointillé/plein sur un module EFML et un module EFMR.
- [x] **3.6** — Prompt : *"Ajoute le suivi cumulatif des heures dispensées par le formateur (semaine/mois/année), avec distinction heures normales/supplémentaires, et alerte si le cumul approche 910h/an, 30h supplémentaires/mois, ou 260h supplémentaires/an."*
  **Test** : simule un cumul dépassant 25h sur une semaine, vérifie que l'alerte se déclenche au bon seuil.
- [x] **3.7** — Prompt : *"Ajoute les rappels calendaires liés aux échéances réglementaires : restitution de notes CC à la 2ème séance suivante, préparation EFM à J-20 avant validation commission, restitution EFM à J+10, affichage résultats à J+15."*
  **Test** : crée un CC avec une date de séance suivante connue, vérifie qu'un rappel apparaît à la bonne échéance.

---

## Phase 4 — Espace stagiaire (compte authentifié obligatoire, mobile-first)

- [x] **4.1** — Prompt : *"Ajoute `'stagiaire'` aux rôles acceptés dans `profils.role`. Lie chaque `stagiaire` à une ligne `auth.users` (compte email/mot de passe). Supprime toute logique reposant sur `token_public` pour l'accès aux groupes et aux contrôles — la passation et la consultation se font uniquement via le compte stagiaire authentifié, jamais par lien public."*
  **Test** : crée un compte stagiaire test, connecte-toi, vérifie l'accès aux données de son propre groupe uniquement (pas celles d'un autre groupe).
- [x] **4.2 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md (section Espace stagiaire mobile-first) : crée le layout `/espace-stagiaire` avec barre de navigation inférieure fixe (Fil / Devoirs / Contrôles / Emploi du temps), cibles tactiles 44px minimum."*
  **Test** : ouvre sur un viewport mobile (375px), vérifie que la barre inférieure est utilisable au pouce.
- [x] **4.3 — Interface** — Prompt : *"En respectant strictement docs/design_system.md : transforme les annonces en fil d'actualité pour les stagiaires — cartes empilées pleine largeur, commentaires, réaction 'j'aime' toujours visibles en bas de carte, mention `@camarade` avec autocomplétion."*
  **Test** : publie une annonce côté formateur, vérifie qu'elle apparaît dans le fil du stagiaire avec les actions commentaire/j'aime fonctionnelles.
- [x] **4.4** — Prompt : *"Crée la fonctionnalité 'devoirs' : table `devoirs` (id, seance_id ou module_id, titre, description, date_echeance, type_rendu texte/fichier/lien), table `devoirs_rendus` (devoir_id, stagiaire_id, contenu, date_rendu, statut). Interface formateur pour assigner un devoir, interface stagiaire pour le consulter et le rendre."*
  **Test** : assigne un devoir test, rends-le depuis un compte stagiaire, vérifie que le formateur voit le rendu.
- [x] **4.5 — Interface** — Prompt : *"Crée la page Contrôles côté stagiaire (accessible depuis le compte authentifié) listant les contrôles de son groupe par module, avec passation directe."*
  **Test** : un stagiaire connecté peut passer un contrôle actif de son groupe sans lien externe.
- [x] **4.6 — Interface** — Prompt : *"Crée la page Emploi du temps côté stagiaire, affichant les séances de son groupe et les dates de contrôle."*
  **Test** : vérifie que l'emploi du temps affiché correspond aux séances réellement planifiées du groupe du stagiaire connecté.
- [x] **4.7** — Prompt : *"Ajoute la possibilité de poser une question sur un support de cours consulté, avec mention `@camarade` possible dans la question ou la réponse. Conserve ces questions en archive pluriannuelle (table dédiée, sans mécanisme de réutilisation automatique pour l'instant)."*
  **Test** : pose une question sur un support test, vérifie qu'elle est bien rattachée au support et visible par le formateur.

---

## Phase 5 — Fonctionnalités périphériques

- [x] **5.1** — Prompt : *"Crée la génération de support de cours 16:9 (diaporama) alignée sur le contenu de la fiche de préparation d'une séance, pour les modules sans cours existant."*
  **Test** : génère un support pour une séance test, vérifie le format 16:9 et la cohérence avec la fiche de préparation associée.
- [x] **5.2** — Prompt : *"Ajoute la prise de présence par séance (liste des absents), avec vue agrégée du taux de présence par stagiaire sur un module."*
  **Test** : marque 2 stagiaires absents sur une séance, vérifie le calcul du taux de présence cumulé.
- [x] **5.3** — Prompt : *"Ajoute le calendrier des jours fériés/vacances OFPPT (saisie manuelle), l'emploi du temps personnel du formateur, et la déclaration d'absence (maladie) visible dans le calendrier."*
  **Test** : déclare une absence sur une date test, vérifie qu'elle apparaît visuellement dans le calendrier.
- [x] **5.4** — Prompt : *"Crée le module stage/soutenance (compétence 16) : suivi du stage (dates, entreprise, tuteur), dépôt des documents (contrat, attestation, note tuteur), les deux grilles de notation (Rapport /20 : présentation /8 + contenu /12 ; Exposé /20 : fond /14 + forme /6) avec noms du jury."*
  **Test** : saisis un stage test avec ses deux grilles de notation, vérifie l'affichage correct des sous-totaux.
- [x] **5.5** — Prompt : *"Crée l'export 'classeur pédagogique' : regroupe les fiches de préparation d'un module/groupe sur une période en un document PDF téléchargeable, dans un format proche du cahier du formateur papier."*
  **Test** : exporte un mois de fiches pour un groupe test, vérifie la lisibilité et la complétude du PDF.

---

## Phase 6 — Déploiement

- [x] **6.1** — *pris en charge par le porteur de projet lui-même, 4 septembre 2026 ; ne plus le compter comme bloquant.*  
  ~~ — Terminal : `npx vercel login` puis `npx vercel link`, et les variables d'environnement listées dans `docs/DEPLOIEMENT.md`. Pas de clé API IA à poser : chaque formateur enregistre la sienne depuis Paramètres, chiffrée dans le Vault Supabase.~~
  **Test** : connecte-toi en formateur et en stagiaire depuis l'URL de production, vérifie que les deux espaces fonctionnent.

- [ ] **6.2 — Activer le crochet de jeton** *(migration écrite, activation à faire par le porteur de projet)*. La migration `075_role_dans_le_jeton.sql` et le code sont prêts et sans effet de bord : tant que le crochet n'est pas activé, `getCurrentUserRole()` retombe sur la lecture PostgREST et l'application se comporte exactement comme avant. Deux gestes restent :
  1. **Appliquer la migration** — `npx supabase db push` (demande le mot de passe de la base ; je ne dois pas le voir).
  2. **Activer le crochet** — tableau de bord Supabase → *Authentication* → *Hooks* → **Customize Access Token (JWT) Claims** → choisir `public.custom_access_token_hook`.

  Ce que ça change : le rôle voyage dans le jeton, donc plus aucun aller-retour PostgREST sur `profils` à chaque rendu du layout protégé — c'est-à-dire sur **chaque page** de l'espace formateur. Et surtout, plus de lecture à refuser : c'est cette lecture qui, refusée « JWT issued at future », remplaçait l'espace entier par la page d'erreur de Next (`47b3df9`).

  **Test après activation** : se déconnecter puis se reconnecter — la revendication n'entre dans le jeton qu'au renouvellement suivant — et vérifier dans les journaux Vercel qu'aucune ligne `[auth] lecture du rôle` n'apparaît plus. Vérifier aussi qu'un compte stagiaire est toujours renvoyé vers son espace.

---

## Phase 7 — Suite validée (ordre strict)

L'ordre ci-dessous est arrêté : chaque atome se termine et se teste avant que le suivant commence.

- [x] **7.1 — Atome 3 · Tableau de service** refait sur la structure exacte du document signé : colonnes `MHT AFF P S1 / S S1 / P S2 / S S2`, cellules FAD vides sur la ligne du groupe qui partage, totaux par colonne et total général `MHT AFF S1+S2 (P+S)`, en-tête (Code Secteur, Formateur, Spécialité, Niveau, Année scolaire), cadre Formateur / Matricule / Signature / Directeur Pédagogique - Directeur d'EFP.
  **Test** : le total recalculé tombe sur 920 h et chaque colonne sur 425 / 80 / 355 / 60, comme le document signé.

- [x] **7.2 — Lot design · correctifs courts**
  - [x] `BandeauIa` variante `engageant` sur l'écran Correction copie — **en priorité dans ce lot** : une correction suggérée par l'IA n'y est aujourd'hui signalée nulle part, ce que §8 du design system interdit explicitement. Trou utilisateur, pas cosmétique.
  - [x] `prefers-reduced-motion` réellement implémenté — documenté en §12 comme « toujours respecté », absent du code.
  - [x] Documenter les quatre composants partagés absents de `design_system.md` : `Segments`, `Interrupteur`, `Breadcrumb`, `GroupeTabs`.
  - [x] Retirer les quatre jetons morts de `globals.css` : `danger`, `forest`, `info`, `neutral`.
  - [x] **Décision tranchée** : sur Préparer un contrôle, le bandeau `engageant` coexiste avec un barème hors 20 en corail, des pastilles et une icône de suppression. Tranché : un message de validation de champ n'est pas un point d'attention au sens de la règle — les deux peuvent coexister. Écrit en §1 de `design_system.md`.
  **Test** : ouvrir Correction copie sur une suggestion IA et vérifier que le bandeau apparaît puis disparaît à la validation ; vérifier qu'aucune transition ne joue avec `prefers-reduced-motion: reduce`.

- [x] **7.2bis — §4.7 · le barème total dépend du type** : un CC se barème sur 20, un EFM sur 40. Le seuil est aujourd'hui écrit en dur à 20 dans huit endroits — l'invite de génération, le rattrapage automatique du total, les deux validations de l'écran, l'affichage du compteur, la liste des copies et l'écran de correction. Un EFM correct à 40 points est donc signalé comme faux, et l'IA reçoit la consigne de totaliser 20.
  **Test** : prépare un EFM, vérifie que 40 points sont acceptés sans avertissement et que 20 en déclenche un ; puis l'inverse sur un CC.

- [x] **7.2ter — §4.7 · calibration pédagogique de la génération** : deux règles absentes de l'invite.
  - Le barème d'une question suit sa difficulté réelle — une question de raisonnement à plusieurs étapes vaut nettement plus qu'une restitution directe — et le modèle **justifie explicitement** ce choix pour chaque question, au lieu de produire des chiffres qui tombent juste au total.
  - La courbe de difficulté vise **60 % du total sur des questions accessibles** (le socle que toute la classe doit pouvoir atteindre : 12/20 pour un CC, 24/40 pour un EFM) et **40 % sur des questions discriminantes**, destinées à distinguer les meilleurs — pas à faire échouer la majorité. Vaut pour les trois formats.
  **Test** : génère un contrôle, vérifie que la répartition des points suit bien 60/40 et que chaque question porte sa justification de barème.

- [x] **7.3 — Devoirs · rendu fichier** : brancher le type de rendu « fichier » au bucket Storage `documents-stage` déjà existant, avec policies par stagiaire, colonne de chemin sur `devoirs_rendus`, formulaire de dépôt côté stagiaire et téléchargement côté formateur.
  **Test** : dépose un fichier depuis un compte stagiaire, vérifie qu'il se télécharge côté formateur et qu'un autre stagiaire ne peut pas le lire.

- [x] **7.4 — §4.15.1 · Schéma multi-année** : table `annees_scolaires` (libellé, dates de validité), `groupes.annee_scolaire_id`, et `annee_scolaire_id` sur `indisponibilites`, `rythmes_hebdomadaires`, `motifs_hebdomadaires` — les trois tables rattachées au formateur qui n'héritent d'aucun groupe. Contrainte sur `seance_groupes` interdisant qu'une séance relie deux groupes d'années différentes.
  **Test** : tenter de partager une séance entre deux groupes d'années différentes doit être refusé par la base.

- [x] **7.5 — §4.15.2 · Sélecteur global** : composant dans `AppShell`, année courante persistée dans `parametres_formateur.annee_scolaire_courante` — pas un cookie, le choix doit survivre à un changement d'appareil.
  **Test** : change d'année, recharge depuis une autre session, vérifie que la sélection tient.

- [x] **7.6 — §4.15.3 · Filtrage** : les ~19 points de requête identifiés (10 sur `groupes`, 9 sur les tables rattachées au formateur) filtrés par l'année sélectionnée. Les données des années passées restent intactes et consultables.
  **Test** : bascule sur une année vide, vérifie qu'aucun écran ne montre les données de l'autre année, puis rebascule et vérifie qu'elles sont toutes revenues.

- [x] **7.7 — §4.15.4 · Duplication** : les quatre étapes dans l'ordre — groupes et assignations (les quatre valeurs semestrielles, `type_efm` et `fad_mutualisee` copiés, pas repartis de la durée de référence), séances sans date avec leurs éléments de contenu (sans rejouer la répartition), fiches de préparation en brouillon, contrôles en brouillon sans passation. Plus la fonction sœur d'`ouvrir_motif` qui date les séances dupliquées une fois le nouveau motif déclaré.
  **Test** : duplique une année, vérifie qu'aucune séance dupliquée ne porte de date, qu'aucun contrôle n'est validé, et qu'aucune copie de stagiaire n'a suivi.

- [x] **7.8 — §4.15.5 · Interface de duplication** : liste de cases à cocher des groupes de l'année source, tous cochés par défaut — décocher avant est réversible, supprimer après ne l'est pas. Déclenchement de la duplication depuis cet écran.
  **Test** : décoche un groupe, duplique, vérifie qu'il est absent de la nouvelle année et intact dans l'ancienne.

---

- [x] **7.9 — Répartition horaire · évaluation réservée et blocs de 2 h 30** (§4.7, §4.9) : les dix heures d'évaluation — CC1 2 h 30, CC2 2 h 30, EFM 5 h — sont réservées avant tout partage et apparaissent en trois lignes du tableau ; toute durée est un multiple de 2 h 30, arrondie par report d'un niveau à l'autre pour que chaque somme reste exacte.
  **Test** : sur un module de 90 h, le total retombe sur 90 h avec 10 h d'évaluation visibles et aucune valeur hors multiple de 2 h 30.
  **Confirmé définitif le 4 septembre 2026** : le porteur de projet a annulé §4.6bis du PRD, qui demandait un nombre et une durée de contrôles configurables par module. Le forfait de 10 h s'applique à tous les modules, y compris les gros. `lib/repartition.ts` est conforme tel quel — aucune correction n'est due, et ce point n'est plus une décision en attente.

---

- [x] **7.10 — Emploi du temps · export PDF** (§4.9) : le bouton était présent et inerte depuis la refonte. Le document reprend la section I.B du cahier du formateur — jours en colonnes, créneaux en lignes, groupe dans la case — avec le motif en vigueur puis les précédents, chacun daté de sa période de validité.
  **Test** : exporter un motif à plusieurs créneaux, dont un partagé entre deux groupes, et vérifier que la grille du PDF reproduit celle de l'écran.

---

- [x] **7.11 — Génération des séances · remplissage intégral des créneaux** (§4.9) : la séquence pédagogique — éléments dans l'ordre, objectifs dans l'ordre, théorique avant pratique — est consommée créneau par créneau au lieu d'être découpée à l'avance. Une séance peut porter deux objectifs, un objectif peut se scinder sur deux séances, aucun créneau ne sort partiellement rempli.
  **Test** : sur un motif mardi/vendredi de 5 h, chaque semaine générée totalise exactement les 10 h que le motif alloue au couple groupe+module — le critère qui compte pour la déclaration E-note.

---

- [x] **7.12 — Calendrier et emploi du temps · grille à quatre créneaux** (§4.10, design §5.4-5.5) : la journée tient en quatre lignes fixes de 2 h 30, une séance qui couvre deux créneaux est dessinée en un seul bloc, et chaque groupe garde la même couleur — à l'écran comme dans les deux PDF. Ce qui tombe hors grille est nommé sous le tableau plutôt que silencieusement absent.
  **Test** : la semaine en cours affiche les blocs fusionnés et la légende des couleurs ; le PDF exporté depuis `/emploi-du-temps` reproduit la même grille.

---

- [x] **7.13 — Fiche et support partagés entre groupes parallèles** (§4.3bis) : une séance peut désigner celle qui porte son contenu (`contenu_source_id`) au lieu d'en garder une copie. Lire, écrire, imprimer le classeur et compter les fiches passent tous par la séance source. Le rapprochement de deux séances est proposé, jamais établi d'office : lier fait qu'écrire ici modifie ce que voit un autre groupe, absent de l'écran. Les contrôles restent hors du partage, exception explicite du PRD.
  **Test** : la base refuse l'auto-référence, les chaînes de miroirs et le fait qu'une source suivie devienne miroir ; supprimer la source promeut le premier miroir et lui transmet fiche et support ; le classeur du groupe miroir imprime bien sa page, et sa séance n'est pas comptée « sans fiche » par le générateur.

---

- [x] **7.14 — Recalcul automatique du placement des séances** (§4.9) : tout changement qui déplace les créneaux — jour non travaillé déclaré ou retiré, créneau ajouté, retiré, **ou déplacé** — replace aussitôt les séances « à faire ». Le déplacement d'un créneau existant n'était même pas possible : il n'y avait que l'ajout et la suppression. Une séance faite n'est jamais touchée, et le recalcul repart du lendemain de la dernière, ce qui interdit de reposer une séance sur un créneau déjà consommé. Un groupe que le motif ne sert plus est signalé, pas vidé. Bandeau pendant le calcul, résultat nommé groupe par groupe.
  **Test** : déplacer le créneau de DES101 du vendredi 8 h 30 au vendredi 13 h 30 replace les 32 séances sur le nouvel horaire, sans en perdre ni en dupliquer, et sans toucher aux séances faites.

---

- [x] **7.15 — Jour de la semaine sur toute date** (design §11) : « Lun. 07/09/2026 » dans les listes denses, « Lundi 07/09/2026 » en détail et dans les documents. La règle vaut pour toute date qui compte — séances, échéances de devoir, stage, période d'un groupe, jours non travaillés, validité d'un motif — pas seulement les séances. Un seul appel produit le jour et les chiffres, pour qu'ils ne puissent pas se contredire. Deux exceptions assumées : la grille du calendrier, qui porte déjà ses jours en en-tête, et l'horodatage « édité le » des PDF, où le jour n'apprend rien.
  **Test** : 07/09/2026 s'affiche « Lundi » — et non « Vendredi », ce que le seul quantième laissait croire.

---

- [x] **7.16 — Garde-fou sur ce qui part au commit** (conventions.md) : trois incidents causés par un `git add -A` sans relecture du diff — un fichier mort remis dans l'arbre, puis deux fois trois sections de design system perdues sous une copie plus ancienne. `scripts/verifie-stage.mjs` refuse un fichier de code ajouté que personne n'importe, un document Markdown qui perd un titre, et un fichier qui perd beaucoup de lignes pour presque aucun ajout.
  **Test** : les trois contrôles rejouent les trois incidents et sortent en erreur ; un contenu sain passe.

---

- [x] **7.17 — Génération de fiche : objectif APC, méthode variée, appui sur les acquis** (§4.3) : le prompt système pose la pédagogie active comme principe, l'objectif se formule en agir observable — les verbes d'état sont refusés et signalés —, la fiche nomme sa `methodeActive`, et la génération connaît celles des six dernières séances du couple groupe+module pour en choisir une autre. La continuité ne se contente plus d'éviter les répétitions : les objectifs et contenus réellement couverts sont passés au modèle, qui doit construire dessus.
  **Test** : sur une vraie génération, objectif « À partir d'un brief client et des verbatims d'entretiens, le stagiaire hiérarchise les besoins selon MoSCoW et rédige une note de cadrage… », méthode « Analyse critique de production » — différente des deux passées en contexte —, et les acquis des séances précédentes cités nommément dans la motivation.
  **Corrigé au passage** : la requête d'historique filtrait sur `seance_groupes.seance_groupes[0]!.groupe_id`, une expression TypeScript copiée dans une chaîne PostgREST. Elle échouait à chaque appel, et comme seul `data` était lu, l'échec passait pour « aucune séance précédente » — le contexte de continuité n'avait jamais atteint le modèle.

---

- [x] **7.18 — Déroulement guidé : quatre phases et mode animation** (§4.3ter, design §5.9) : la fiche est structurée en mise en situation, activité, structuration, réinvestissement — schéma fixe, linéaire, sans phase conditionnelle. Il **remplace** la structure minutée (motivation/plan/développement/évaluation/prochaine), à l'écran, dans le PDF officiel et dans le classeur. La structuration se nourrit des critères particuliers de performance du référentiel, pas de notions inventées. Un écran d'animation à part (`/animer`) affiche une phase à la fois, avec ses instructions, ses questions prêtes à poser, et un bouton pour passer à la suivante ; l'avancement vit sur la séance (migration 072) et non dans la fiche, deux groupes parallèles n'étant jamais au même point.
  **Test** : sur une génération réelle, les quatre phases sortent dans l'ordre, chacune avec sa méthode et ses instructions, les minutes tombent sur 150, et la structuration reprend mot pour mot les critères du référentiel. Les deux fiches déjà en base au format minuté se convertissent sans perdre une ligne ni une minute. La contrainte de base refuse une phase hors de 0-4.

---

- [x] **7.19 — Support : cohérence avec la fiche, et contenu riche** (§4.4, design §5.10) : la génération du support lit d'abord la fiche de la séance — celle de la source quand la séance est un miroir — et doit honorer chaque ressource qu'elle annonce, qu'elle vienne du champ « fichiers de travail » ou d'une URL semée dans les phases. La vérification est faite après coup et nomme ce qui manque, plutôt que de faire confiance à la consigne. Le support gagne des ressources externes typées par origine (fiche / proposée) et des figures — des étapes nommées, pas des images. Chaque lien est appelé à la génération : celui qui ne répond pas est signalé au formateur et n'est ni montré au stagiaire ni imprimé.
  **Test** : sur une génération réelle à partir d'une fiche annonçant trois ressources dont une URL, les trois sont honorées, deux figures sont produites, et le modèle laisse `url` à null sur les deux ressources qu'il ne sait pas lier plutôt que d'inventer une adresse. La détection de lien mort distingue une page réelle, une page absente d'un domaine réel, et un domaine inexistant.
  **Corrigé au passage** : la génération de support portait le même filtre PostgREST fautif que celle de fiche — « déjà traité avec ce groupe » était toujours vide.
  **Non fait, tranché par le porteur de projet le 4 septembre 2026** : les images du §4.4. Ni dépôt manuel, ni service de génération payant — on reste sur les schémas texte (étapes reliées par des flèches).

---

- [x] **7.20 — Deux documents par module, et la correction de TP** (§4.4) : un module porte désormais deux documents distincts et nommés — « Support du cours — [Module] » et « Pratique de [Module] » — chacun listant ses séances, celles qui sont rédigées et, pour les TP, celles qui sont corrigées. La proposition de correction se génère à partir de l'énoncé réellement remis, jamais du référentiel seul, et reprend son barème sans le renommer.
  **Deux verrous, posés en base et non dans la route** : la correction n'existe que sur une séance **pratique** et **faite** — un trigger le refuse sinon —, et elle est fermée aux stagiaires par défaut. La visibilité est traitée en 7.21.
  **Test** : la base refuse une correction sur séance théorique et sur séance pratique non faite, l'accepte une fois la séance marquée faite, et n'en laisse lire aucune sans authentification. Sur une génération réelle, une étape par consigne (4/4), les quatre critères de l'énoncé repris tels quels, barème à 20/20, et une règle de notation par critère.

---

- [x] **7.21 — Partage de la correction, décidé TP par TP** (§4.4) : `corrections_tp.partagee_avec_stagiaires`, faux par défaut y compris après que la séance est faite. Le formateur ouvre et referme depuis l'écran de correction ; la policy de lecture stagiaire exige **le drapeau et l'appartenance au groupe**, jamais l'un sans l'autre. Refermer bloque les accès à venir — l'écran de confirmation dit explicitement que ça ne revient pas sur ce qui a déjà été lu ou enregistré, plutôt que de laisser croire à un retrait rétroactif.
  **Test** : protocole d'isolation sur deux comptes stagiaires temporaires, un par groupe, supprimés ensuite — non partagée personne ne voit ; partagée le groupe voit et l'autre groupe non ; refermée le groupe ne voit plus ; un stagiaire ne peut ni modifier la correction, ni changer le drapeau de partage, ni en créer une ; anonyme ne voit rien. Base rendue intacte : 0 correction, 15 stagiaires, 2 comptes auth.

---

- [x] **7.22 — « Grille de correction » côté formateur, « Corrigé » côté stagiaire** : l'application note déjà des copies de contrôle toute seule ; appeler « correction » un document qui ne note rien laissait croire que le TP se corrigeait aussi tout seul. Deux libellés parce que ce ne sont pas les mêmes lecteurs, et la mention explicite que la grille est facultative. Les noms techniques ne bougent pas.

---

- [x] **7.23 — Export complet d'un module** (§4.4) : chacun des deux documents se télécharge en un PDF unique — page de garde avec identité de l'établissement et sommaire daté, puis une séance par chapitre, chacune ouvrant sa page. Distinct du classeur pédagogique (§4.13), qui compile les fiches du formateur : ici c'est le contenu remis aux stagiaires. Le rendu d'un support est désormais une fonction partagée entre l'export d'une séance et la compilation — le réécrire aurait produit deux mises en page du même contenu.
  **Test** : compilation des deux documents de M202 sur les supports réels — 3 pages chacun, sommaire correct, rangs suivant l'ordre du programme et non la liste filtrée (une séance non rédigée ne renumérote pas la suivante), et une compilation vide produit une page de garde seule au lieu d'une erreur.

---

- [x] **7.24 — Les dix générateurs PDF portent l'identité de l'app** (design §3) : `lib/pdf-theme.ts` porte la palette du §1 et les quatre fontes du design system, lues une fois puis gardées. Les générateurs nomment un **rôle** — titre, corps, corpsGras, mono — jamais une fonte. Les TTF vivent dans `public/polices` (640 Ko), chargés au moment d'un export et mis en cache par le navigateur ; si la lecture échoue, le document sort en Helvetica plutôt que de ne pas sortir.
  **Constat de départ** : dix générateurs, zéro conforme. Tous sur Helvetica, et **cinq définitions différentes de `GRIS`, quatre de `TRAIT`, trois de `FOND`**, aucune tirée du design system — le Tableau de service compris, dont seule la mise en page était soignée.
  **Test** : les sept générateurs sont exécutés sur des données d'exemple et le PDF produit est inspecté — `/BaseFont /Sora`, `/SourceSans3` et `/PlexMono` présents dans les sept. Plus aucune constante de couleur locale dans `lib/pdf-*.ts`, et le seul `helvetica` restant est le repli assumé de `pdf-theme.ts`.

---

- [x] **7.25 — Un chapitre par contenu, pas par séance** (§4.4) : la liste des documents d'un module comptait une entrée par séance et affichait donc quatre fois le même cours sur M104 — deux causes empilées, **deux groupes parallèles** suivant le même module et **un objectif étalé sur plusieurs créneaux**. Le regroupement se fait désormais sur l'objectif et la nature, à l'écran comme dans la compilation PDF, et chaque ligne dit combien de séances elle recouvre.
  **Écarté après mesure** : mettre l'ensemble des éléments de contenu dans la clé. C'était le premier réflexe, mais le remplissage des créneaux (§4.9) coupe la séquence là où le créneau finit, pas là où l'objectif change — B.1, B.2, C.1 et C.2 restaient dupliqués. Un chapitre est un objectif, ce qu'un sommaire donne à lire.
  **Test** : M104 passe de 40 à 8 chapitres en cours et de 24 à 8 en pratique, M202 de 9 à 7 et de 7 à 7 ; aucun objectif en double, aucune séance orpheline.

---

- [x] **7.25bis — Le badge d'un chapitre dit ce qui manque** (§4.4) : conséquence du regroupement, relevée par le porteur de projet. Un chapitre qui couvre quatre séances et dont une seule porte son support s'affichait « rédigé » — trois séances restaient vides, et le stagiaire qui en ouvrait une ne voyait rien. Le badge compte désormais : « à rédiger », « 1 / 4 rédigés », « rédigé ». Même traitement pour les grilles de correction d'un TP.
  L'avancement en tête de document ne compte que les chapitres **entièrement** rédigés : compter un chapitre à moitié écrit comme fait donnerait un indicateur flatteur et faux.
  **Test** : les trois états sur des chapitres fabriqués (0, 1, 3 et 4 supports sur 4 séances), et un document de 4 chapitres dont un commencé affiche 2/4, pas 3/4.
  **Non fait, en attente d'arbitrage** : propager automatiquement un support aux autres séances du même objectif. Ça fermerait le trou pour de bon, mais impliquerait qu'un objectif ne puisse jamais avoir deux supports distincts.

---

- [x] **7.27 — Le groupe est visible sur chaque contrôle d'un module** (§4.7, design §5.4) : deux groupes suivant le même module produisaient quatre lignes au titre identique, sans rien pour les distinguer — la donnée était en base depuis toujours, c'était un défaut d'affichage. Le tableau gagne une colonne Groupe portant la pastille de couleur du calendrier, avec le nom en clair à côté : la couleur seule ne porte jamais l'information (§11). Les lignes sont regroupées par groupe, DES101 avant DES102.
  **Second défaut trouvé sur les mêmes lignes** : le bouton « Ouvrir » pointait vers `/modules/[id]/controle` sans paramètre de groupe, et cette adresse redirige vers la page du module. Le bouton ne faisait donc rien. Il porte désormais le groupe de sa ligne.
  **Audit des autres écrans** : l'historique des contrôles est déjà borné à un groupe et redirige sans lui ; les échéances réglementaires affichent déjà `groupeNom` ; le tableau de bord compte les contrôles sans les lister ; l'espace stagiaire ne voit que son propre groupe. Aucun autre écran ne porte ce défaut.
  **Test** : sur M104, les quatre contrôles s'affichent avec leur groupe, DES101 puis DES102 sans entrelacement, deux couleurs de pastille distinctes, et chaque ligne produit une URL qui ouvre réellement son contrôle.

---

- [ ] ~~**7.26 — Regroupement des ressources côté stagiaire et vue progressive** (§4.4, §4.5)~~ — **abandonné le 4 septembre 2026, décision du porteur de projet.** Les paragraphes correspondants restent dans le PRD ; ils ne sont pas implémentés et ne sont pas à reprendre sans nouvelle demande.
  **Ce qui existe déjà de ce périmètre, par ricochet d'autres atomes** : le support d'une séance et son corrigé partagé (§4.4) sont sur la même page côté stagiaire, et `devoirs.seance_id` est en base depuis la Phase 4 — la vue Devoirs ne l'exploite simplement pas. Rien à défaire si la décision change.

---

## Phase 8 — Espace formateur responsive (design §3bis)

L'espace formateur était pensé desktop-only ; il doit désormais fonctionner sur mobile au même niveau de finition que l'espace stagiaire. **27 écrans formateur**, découpés en 9 atomes, dans l'ordre de priorité du §3bis : le quotidien d'abord, la configuration lourde en dernier.

- [x] **8.1 — Socle mobile** : les primitives que les huit atomes suivants réutilisent, plutôt que huit interprétations du même pattern.
  - `components/ui/ListeCartes.tsx` — une liste décrite par ses colonnes, rendue en tableau au-dessus de 768px et en cartes en dessous. Chaque colonne porte un rôle (`titre`, `meta`, `detail`, `action`) qui dit sa place dans la carte. Les deux rendus coexistent dans le DOM, l'un caché par CSS : détecter la largeur en JavaScript ferait clignoter la liste à l'hydratation et se tromperait au rendu serveur.
  - **Cibles tactiles à 44px sous 768px** : `Button` sur ses trois tailles courantes, et le menu « … » à 44×44 avec ses entrées à 44 de haut.
  - **Menu « … » repositionné** : il s'alignait sur le bord droit du bouton et sortait de l'écran quand ce bord était trop à gauche — visible seulement sur petit écran.
  - **Vérifié** : le tiroir hamburger annoncé par le §3bis comme « déjà en place » l'est effectivement (`AppShell`, overlay `md:hidden`). Rien à faire de ce côté.
  **Test** : rendu comparé à 375px et à 1280px sur une liste de trois modules — cartes empilées d'un côté, tableau à six colonnes de l'autre, état vide dans les deux cas.

---

- [x] **8.2 — Le quotidien : tableau de bord, présences, animation** (design §3bis) : les trois écrans que le §3bis désigne comme consultés depuis un téléphone.
  - **Présences** — le tableau passe par `ListeCartes`. Le dépliant d'absences vit dans la colonne `titre` et se retrouve donc dans la carte, sous le nom du stagiaire ; il fallait pour cela que `ListeCartes` accepte du contenu en bloc dans son titre, ce qu'un `<span>` ne permettait pas. Le filtre de module prend toute la largeur sous 768px.
  - **Tableau de bord** — les tuiles et les graphiques étaient déjà fluides (`auto-fit`, `ResponsiveContainer`). La ligne de groupe, elle, tenait sur trois colonnes fixes serrées à 375px : elle s'empile désormais, le nom d'abord, la date et la barre d'avancement côte à côte ensuite.
  - **Animation** — le §3bis l'annonce nativement compatible, et il l'est sur la structure. Restaient les cibles : onglets de phase, lien « Quitter » et boutons de navigation à 44px, marges latérales réduites, et surtout les **quatre titres de phase remplacés par leur numéro sous 768px** — ils se chevauchaient. La piste colorée situe déjà l'avancement, et le titre complet reste en tête de la phase ouverte.
  **Test** : `tsc` et build verts. Le rendu visuel reste à vérifier dans l'application — le navigateur intégré n'a pas de session ouverte.

---

- [x] **8.3 — Calendrier : une journée à la fois sous 768px** (design §3bis) : la grille hebdomadaire réclamait 680px de large ; elle ne s'affiche plus qu'au-dessus de 768px. En dessous, une bande de six jours sert à la fois de sélecteur et de vue d'ensemble — chaque jour porte son nom, son quantième et un point quand il compte des séances. Le jour ouvert affiche ses créneaux dans l'ordre, avec les mêmes cartes de séance qu'en grille, couleur de groupe comprise.
  **Choix** : la bande de jours plutôt que de simples flèches précédent/suivant. Le §3bis autorisait les flèches, mais elles auraient fait disparaître ce que la grille donne gratuitement — savoir d'un regard que le jeudi est chargé. La bande coûte une ligne et rend cette information.
  L'écran s'ouvre sur aujourd'hui quand la semaine affichée le contient, sur le lundi sinon. Un jour non travaillé le dit en toutes lettres au lieu d'un motif hachuré, illisible sur une carte.
  **Test** : `tsc` et build verts. **Rendu visuel non vérifié** — le navigateur intégré est resté sur l'écran de connexion.

---

- [x] **8.4 — Les listes principales** (design §3bis) : groupes, modules, fiche de groupe, et `GroupModulesList` — ce dernier sert à lui seul trois écrans (modules d'un groupe, contrôles, fiches).
  - **`GroupModulesList`** — la ligne portait l'intitulé à gauche, le badge et le bouton « Ouvrir » à droite ; sous 768px le bouton écrasait l'intitulé. Elle s'empile, et l'intitulé cesse d'être tronqué une fois seul sur sa ligne.
  - **Modules** — pseudo-tableau à quatre colonnes fixes qui tenaient à peine dans 375px. Les lignes s'empilent, l'en-tête de colonnes disparaît sous 768px (il ne décrit plus rien), et le menu « … » se cale en haut à droite de la carte au lieu de rester seul sur une ligne.
  - **Groupes** — la grille de cartes exigeait 320px minimum, soit un cheveu de trop une fois les marges retirées d'un écran de 375. Passée à 280px.
  - **Marges** — 16px au lieu de 24px sous 768px sur ces écrans et sur la coquille de groupe : 32px de contenu rendus aux cartes.
  **Décidé en chemin** : ne pas faire passer ces écrans par `ListeCartes`. Leur rendu desktop n'est pas un `<table>` mais une grille sur mesure qui fonctionne ; les y forcer aurait changé l'apparence bureau, ce que ce chantier ne demande pas. `ListeCartes` reste pour les vrais tableaux.
  **Relevé, à traiter dans les atomes de formulaire** : **12 fichiers basculent à 640px (`sm:`) là où le §3bis fixe la bascule à 768px** — 13 occurrences de `sm:grid-cols-2` notamment. Entre 640 et 768px, ces formulaires affichent donc deux à quatre colonnes sur une largeur que le design system considère comme mobile. Corrigé ici sur la fiche de groupe ; le reste relève de 8.6 et 8.7.
  **Test** : `tsc` et build verts. **Rendu visuel non vérifié** — aucune session dans le navigateur intégré (zéro cookie, zéro stockage local).

---

- [x] **8.5 — Listes secondaires, et deux défauts de structure** (design §3bis) : premier atome **vérifié à l'écran**, via l'extension Claude in Chrome et la session réelle du porteur de projet. Mesures faites à 591px de viewport.
  - **`AppShell` — le défaut qui faisait défiler TOUS les écrans.** La colonne de contenu est un enfant flex sans `min-w-0` : elle gardait donc la largeur minimale de son contenu — 661px mesurés dans un viewport de 591 — et poussait chaque page hors cadre. Une classe. C'est très probablement ce que le porteur de projet voyait quand « rien ne s'affichait » en responsive.
  - **`GroupeTabs` — six onglets qui poussaient la page à 799px.** La barre défile désormais pour elle-même, en débordant jusqu'aux bords de l'écran pour que le geste soit naturel. Un défilement voulu et borné, pas celui que le §3bis interdit. Corrige les six sous-écrans d'un groupe d'un coup.
  - **Contrôles d'un module** — le seul vrai `<table>` du lot, passé par `ListeCartes`.
  - **Mesuré sans rien trouver** : progression, couverture, devoirs, annonces, journal, historique ne débordent plus une fois les deux défauts ci-dessus corrigés.
  **Test** : `document.scrollWidth === clientWidth` sur modules, calendrier, fiche de module et progression après correction ; captures d'écran à l'appui. Les deux défauts de structure relevaient du socle 8.1 — je ne les avais pas vus faute de pouvoir regarder.

---

- [x] **8.6 — Détail de séance, fiche, classeur** (design §3bis) : premier atome vérifié à **386px réels**. La fenêtre Chrome étant maximisée et refusant de rétrécir, la page est chargée dans un cadre de 390px qui applique les vraies requêtes média — même CSS, même rendu qu'un téléphone.
  - **Fiche de préparation** — quatre bascules à 640px passées à 768, dont l'en-tête à quatre colonnes et le couple méthode/durée d'une phase. Entre 640 et 768px, ces blocs repassaient en colonnes sur une largeur que le §3bis tient pour mobile.
  - **Classeur** — la page ne portait **aucune marge** : son titre touchait le bord de l'écran, à toutes les largeurs. Personne ne l'avait vu parce que personne ne l'avait regardé de près.
  - **Marges de page harmonisées à 16px sous 768px** sur cinq écrans qui divergeaient : classeur (0), calendrier (24), tableau de service (24), emploi du temps (32), journal (32). Le journal cumulait en plus deux marges.
  **Vérifié sans rien trouver** : le détail de séance et la fiche de préparation d'un module ne débordent pas et se lisent bien à 386px — la barre d'onglets défile, les phases s'empilent, les boutons tiennent.
  **Relevé pour 8.7** : `/parametres` **déborde** à 386px. C'est le prochain atome, il commencera par là.

---

- [x] **8.7 — Configuration, et deux défauts systémiques** (design §3bis) : l'atome devait traiter paramètres et stage ; il a surtout mis au jour deux règles cassées à l'échelle de l'application.
  - **`Segments` — trois onglets qui poussaient la page à 436px.** Le composant sert aussi le parcours de contrôle. Les libellés ne se coupent pas en deux ; quand ils ne tiennent pas, c'est la gouttière qui défile. `basis-0 grow shrink-0` plutôt que `flex-1`, pour que l'ordre des classes ne puisse pas décider du résultat.
  - **21 bascules à 640px passées à 768**, sur 14 fichiers. Le §3bis fixe la limite à 768 : entre les deux largeurs, ces formulaires affichaient deux à quatre colonnes sur un écran tenu pour mobile. Les `sm:block` et `sm:inline` du Topbar et de la carte de stage ne sont pas des colonnes — laissés tels quels.
  - **26 grilles sans colonne de base.** `grid gap-4 md:grid-cols-2` ne déclare aucune colonne sous 768px : la grille en crée une seule, dimensionnée sur le contenu. C'est ce qui faisait sortir la fiche d'un module à 583px, avec un titre de 462px dans une carte de 358. Toutes portent désormais `grid-cols-1` explicite.
  - **Modules d'un groupe** — badge d'heures, ventilation S1/S2 et bouton refusaient de rétrécir : ils passent à la ligne.
  **Test** : douze écrans mesurés à 390px, `scrollWidth === clientWidth` sur les douze — modules, paramètres, calendrier, stage, fiche de groupe, progression, tableau de bord, emploi du temps, tableau de service, classeur, liste des modules, liste des groupes.

- [x] **8.8 — Parcours de contrôle** (design §3bis) : aucun de ces écrans ne débordait. Ce qu'ils faisaient est plus insidieux — ils effaçaient l'information et rendaient les commandes intouchables.
  - **La frise d'étapes effaçait ses libellés.** Mesurés à 390px, les trois premiers étaient à **zéro pixel de large** : `truncate` les avait réduits à rien, et seule « Relecture » survivait parce que sa case ne se rétracte pas. Sous 768px la frise ne garde que ses ronds numérotés, portés à 44px — l'en-tête de la page annonce déjà « Étape 3 sur 4 · Questions » deux lignes plus haut. `sr-only` et non `hidden`, pour que les libellés restent annoncés par un lecteur d'écran.
  - **Toutes les cibles de l'éditeur de questions étaient sous 44px** : type 32, difficulté **27**, barème 34, suppression 32, justification 36, cases du QCM **16**. La case garde ses 16px — l'étirer donnerait un rectangle ; c'est son label qui porte la zone tactile.
  - **La ligne d'une proposition de QCM tenait trois contrôles sur 232px.** Le champ tombait à 126px. Sous 768px il prend sa ligne, la case et la corbeille passent dessous — et le mot « Correcte » apparaît, sans quoi la case détachée du champ ne dirait plus ce qu'elle coche.
  - **La navigation d'étapes empilait tout à gauche** : l'action principale se retrouvait sous une phrase. Grille à deux colonnes, les deux boutons face à face, la consigne sur sa propre ligne.
  - **`CorrectionManager` : une 27ᵉ grille sans colonne de base**, non vue au balayage de 8.7.
  - **L'historique était un tableau dense brut** — converti en `ListeCartes`. Sa colonne « Modifications » rend une liste de champs : `ListeCartes` gagne l'option `pleineLargeur`, sans quoi ce détail se serait retrouvé à moins de 120px dans le `dl` à deux colonnes.
  **Test** : mesuré à 390px et **contre-mesuré à 1200px** — c'est ce second passage qui a rattrapé une régression, `flex-wrap` combiné au `w-full` d'`inputStyles` renvoyant les trois contrôles à la ligne y compris sur bureau.
  **Non vérifié à l'écran** : les copies, la correction d'une copie et le corps de l'historique. La base ne contient **aucune passation** (`content-range: */0`) ni aucune entrée d'audit — ces trois écrans ne rendent que leur état vide. Corrigés à la lecture, à revoir dès qu'un stagiaire aura rendu une copie.

- [x] **8.9 — Les trois grilles larges** (design §3bis) : les seules qui restaient à défiler horizontalement dans leur conteneur. Chacune a l'équivalent mobile que le §3bis lui assigne, plutôt qu'un défilement latéral.
  - **Emploi du temps** (`GrilleMotif`, 720px) → **une liste par groupe** : le groupe en tête avec sa couleur, ses créneaux dessous, un par ligne — `DDOUX201 · Lun 13 h 30–18 h 30 · Mar 8 h 30–13 h 30 …`. C'est la lecture la plus fréquente de toute façon : « ce groupe, je le vois quand ? ». La liste prend `motif.creneaux` et non les cases placées : elle n'a pas la contrainte des blocs de 2 h 30, donc elle en montre **davantage** que la grille — d'où l'avertissement « n'apparaît pas dans la grille » masqué sous 768px, où il serait faux.
  - **Tableau de service** (960px, neuf colonnes) → **une carte par affectation**, les quatre valeurs horaires en mini-tableau 2×2 : c'est la seule information du document qui se lise par comparaison, S1 face à S2 et P face à S. Le total et le MHT AFF général ferment la liste dans leur propre carte.
  - **Répartition horaire** (720px) → **une carte par objectif**, avec **théorique et pratique appariés à l'intérieur** — seule exception accordée à la règle « jamais deux champs côte à côte » : on les saisit l'un en fonction de l'autre, et leur somme doit rester sous les yeux. Les lignes d'évaluation, dont les heures sont réservées d'office, ont une carte sans champ.
  **Test** : mesuré à 390px et contre-mesuré à 1200px sur les trois — `scrollWidth === clientWidth` partout, tables toujours visibles sur bureau (866 / 960 / 770 px) et listes mobiles bien masquées.

- [x] **8.10 — Le cours rédigé, lu depuis un téléphone** (design §6) : `DocumentRedige` avait été écrit pour la page A4 puis réutilisé tel quel dans la lecture du stagiaire, qui consulte « quasi exclusivement depuis son téléphone ». Mesuré à 375px, ce que ça donnait : corps à 14px, tableaux à 13px, étiquettes d'encadré à 10,5px, une couverture de **894px sur un écran de 1018** — une page de garde entière à faire défiler avant la première ligne de cours — et surtout **la page elle-même défilant en travers** sur 530px de large.
  - **Échelle typographique** rehaussée sous 768px : corps et listes à 16px, valeurs de tableau à 15px, sous-titres à 17px. Les étiquettes en petites capitales monospace restent volontairement plus petites — ce sont des surtitres, pas du texte courant.
  - **Tableaux → blocs empilés** (§3bis) : sous 768px, une ligne devient un bloc — la première cellule en titre, les autres en `étiquette / valeur`. Quatre des dix-sept tableaux débordaient ; à 375px, quatre colonnes de texte donnaient des mots coupés lettre à lettre. Une ligne entièrement vide — la trame d'un tableau à remplir — ne donne pas de bloc : c'est le PDF qui porte l'espace où écrire.
  - **Couverture ramenée à 677px** : elle garde son rôle — dire de quel support il s'agit — sans prendre la hauteur d'un écran, d'autant que le titre et la date de la séance sont déjà affichés au-dessus.
  - **Défilement horizontal supprimé** : deux causes distinctes, le tableau qui élargissait son conteneur faute de `min-w-0` sur la colonne flex, et les lignes à remplir — des suites de tirets bas, insécables — qui poussaient la page à 530px.
  **Test** : mesuré à 375px et contre-mesuré à 1280px. À 375 : `scrollWidth === clientWidth`, zéro élément hors page, 88 blocs empilés, aucun tableau visible, corps à 16px. À 1280 : 17 tableaux visibles, zéro bloc empilé, corps à 14px, tableaux à 13px, grille à trois colonnes — le rendu de bureau est inchangé, ce qui vaut aussi pour l'onglet Document du formateur.
  **Non vérifié à l'écran réel** : la page stagiaire elle-même, faute de session ouverte ; la mesure a porté sur `DocumentRedige` monté dans le même cadre que `SupportLecture`.

- [x] **8.11 — Un second support par séance, celui du formateur** (PRD §4.4) : le formateur prépare deux documents et l'application n'en portait qu'un. Le support du stagiaire est remis ; le sien — conduite de séance, réponses attendues — n'a jamais eu d'endroit où vivre.
  - **Une colonne, pas une table.** `supports_seance.destinataire` (`stagiaire` | `formateur`, migration `078`). C'est le même objet : mêmes versions, même partage entre séances miroir, même diaporama, mêmes PDF. Une seconde table aurait dupliqué le schéma, les policies et les index, et les aurait laissés diverger au premier changement. L'unicité passe de `(seance_id, version)` à `(seance_id, destinataire, version)` — sans quoi les deux supports se seraient disputé le numéro 1 ; la contrainte est retrouvée par sa définition, son nom ayant été donné par Postgres.
  - **La garantie est dans la policy, pas dans les `select`.** `supports_lecture_stagiaire` ajoute `destinataire = 'stagiaire'` : une requête qui oublierait le filtre ne suffit pas à montrer au stagiaire ce qui ne lui est pas destiné. Les cinq lectures côté application le filtrent aussi, pour que l'intention se lise dans le code.
  - **Un composant, deux destinataires.** `SupportSeance` prend une prop plutôt que d'être dupliqué : dupliquer l'écran aurait garanti qu'une amélioration apportée à l'un manque à l'autre au bout d'un mois. Le pied de page et le nom de fichier portent le suffixe, faute de quoi le second PDF écraserait le premier dans le dossier de téléchargements.
  - **Quatre onglets ne tiennent plus sur 375px** : la barre défile horizontalement plutôt que de couper un libellé — défilement contenu, pas celui de la page.
  **Test** : compilation verte, garde « use server » passée. **Non vérifié à l'écran** : la migration `078` n'est pas appliquée, donc l'onglet ne peut rien enregistrer tant que `npx supabase db push` n'a pas tourné.

---

## Phase 9 — Le dossier d'épreuve, le stagiaire, et ce qui prévient

Les demandes du porteur de projet depuis le 7 septembre 2026, consignées après coup : le journal s'était arrêté à 8.11 pendant que les atomes continuaient. Regroupées par sujet plutôt qu'un point par commit — l'ordre chronologique exact est dans `git log`.

- [x] **9.1 — Le dossier d'épreuve s'imprime d'un seul geste** (PRD §4.9) : le résultat à signer est devenu une pièce administrative — cartouche d'identification partagé (`lib/pdf-cartouche.ts`), horaire d'épreuve lu dans l'emploi du temps et non saisi, réponse du stagiaire, réponse attendue et commentaire du formateur par question, QR code vectoriel sous les signatures (UUID, nom, note), CEF **et** CNE. Autour de lui : une feuille d'émargement d'une page, une page de garde à coller sur le dossier physique, un sujet vierge à faire viser par le chef de pôle, et un bouton unique qui assemble le tout — `Dossier_CC1_DDOUX201_M104_2026-09-07.pdf`.
  **Test** : PDF produits en Node, audités à la page avec pdf.js (débordement, chevauchement, page vide, échappements résiduels), rendus avec `@napi-rs/canvas`, QR relus avec `jsqr`. Treize copies de test créées puis supprimées par identifiant, sauvegarde JSON écrite avant, comptages avant/après relevés.

- [x] **9.2 — Commenter un cours était impossible depuis la migration 052** : `poser_question_support` lisait `seances.groupe_id`, colonne supprimée le jour où une séance est devenue partagée entre groupes. Aucun stagiaire n'a jamais pu poser de question, et le formateur n'a jamais rien reçu à répondre. Migration `080` la réécrit sur `seance_groupes`, séances miroir comprises. Le panneau du formateur gagne au passage les commentaires d'annonce et les « j'aime », qu'il ne recevait pas non plus.
  **Test** : RPC appelée en conditions réelles — l'erreur `42703 column s.groupe_id does not exist` reproduite avant, la question posée après. Un `404 PGRST202` sur une RPC appelée à vide signifie « aucune surcharge ne correspond », pas « fonction absente » : trois faux négatifs de vérification viennent de là.

- [x] **9.3 — La photo du stagiaire, des deux côtés** (migrations `081`, `083`) : bucket `photos`, policies sur `storage.objects`, et le même composant dans l'en-tête de l'espace stagiaire et dans la fiche du formateur — chacun peut la poser, chacun peut la retirer.

- [x] **9.4 — Le stagiaire de la journée** (PRD §4.5, migration `082`) : le formateur note la participation sur 10, un visage à la fois ; `designer_stagiaire_du_jour` tranche, compte la série et publie l'annonce d'un seul tenant. Le départage entre notes égales revient au moins récemment distingué — une distinction qui revient toujours au même cesse d'encourager les autres. Le groupe l'apprend en arrivant, une fois, feux d'artifice compris ; le formateur peut revoir la même fête depuis la séance.
  **Test** : départage simulé en lecture seule sur les seize stagiaires réels de DDOUX201 avant d'écrire la fonction. Séance de test créée puis supprimée à la demande, comptages avant/après relevés.

- [x] **9.5 — Le graphe du tableau de bord montrait le futur, donc zéro** : la fenêtre allait jusqu'à la fin de la période et le cumulatif repartait à zéro à son début. Bornée à aujourd'hui, amorcée avec tout ce qui précède. Les heures réalisées se placent désormais à la **date de la séance** et non à celle du pointage : un rattrapage de trois séances saisi un dimanche soir dessinait une marche là où il n'y en avait pas.

- [x] **9.6 — Ouvrir une séance n'allume plus l'onglet « Stagiaires »** : `ongletGroupeActif` ne reconnaissait pas le segment `seances` et retombait sur le premier onglet. Rattaché à « Progression », d'où l'on vient. Le fil d'Ariane qui redisait le groupe et la section — déjà écrits deux fois au-dessus — cède la place à `RetourListe`, un lien qui ne dit qu'une chose.

- [x] **9.7 — Un fil de commentaires ne déroule plus tout** : les quatre derniers, et « Voir les N commentaires précédents » pour le reste. Dans les deux espaces, le composant étant partagé.

- [x] **9.8 — Une notification mène au commentaire, pas à la page** : chaque commentaire et chaque question porte son ancre (`#commentaire-<id>`, `#question-<id>`) ; le fil replié se déplie tout seul quand l'ancre le désigne, défile jusqu'à lui et le surligne trois secondes. Les liens du panneau formateur pointent l'ancre, l'onglet Support d'une séance s'ouvre par `?onglet=`. Un fil de dix-sept réponses ne se parcourt pas pour retrouver celle qui a sonné.

- [x] **9.9 — Le stagiaire est prévenu de ce qui se passe dans son groupe** : sa cloche était inerte depuis toujours, le panneau n'existant que côté formateur. `getNotificationsStagiaire` lui remonte les annonces, les commentaires de ses camarades et les réponses du formateur aux questions de cours, sur quatorze jours — jamais ses propres mots. Un seul `PanneauNotifications` pour les deux espaces, paramétré par sa source, son titre, son résumé et son état vide : deux panneaux auraient divergé au premier correctif. La pastille compte ce qui est arrivé depuis la dernière ouverture, retenue dans le navigateur — il n'y a rien à marquer comme lu en base, puisque rien ne se résout.
  **Test** : compilation et build verts, gardes passées ; requêtes rejouées en SQL sur les données réelles pour un stagiaire tiré au sort — 1 annonce, 16 commentaires de camarades et 1 réponse du formateur remontent sur la fenêtre de quatorze jours. **Non vérifié à l'écran** : faute de session stagiaire ouverte.

---

## Points de vigilance — pas des atomes

À garder en tête à chaque changement de schéma, sans traitement immédiat.

- **60 casts `as unknown as`** désactivent le typage sur les chaînes `select` de PostgREST. C'est le trou qui a laissé passer `fiches_prescrites_legacy` et `seances.groupe_id` après leur suppression : un changement de schéma se vérifie en relisant les chaînes `select`, pas en lançant `tsc`.
- Les **colonnes générées** (`masse_horaire_allouee`, `heures_fad`, `code_operationnel`) ne sont pas marquées en lecture seule par les types Supabase générés. Une écriture dessus passe `tsc` et échoue à l'exécution.

---

Traite les phases dans l'ordre. Ne commence jamais une interface (Phase 3-4) avant que le schéma correspondant (Phase 1-2) soit validé — c'est ce qui a causé la dérive du premier prototype.