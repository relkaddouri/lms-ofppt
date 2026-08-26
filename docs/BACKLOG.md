# BACKLOG.md — LMS OFPPT, backlog atomique v2

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
- [ ] **1.10** — Prompt : *"Ajoute les frontières d'erreur manquantes, conformément à docs/conventions.md L.39 : aucune erreur technique brute ne doit être montrée à l'utilisateur. Crée `app/error.tsx` et `app/(protected)/error.tsx` avec un message clair, une action de reprise, et la journalisation de l'erreur côté console. Ajoute aussi `app/not-found.tsx`. Respecte docs/design_system.md."*
  **Test** : provoque une erreur de rendu dans une page protégée (ex. coupure de la base), vérifie qu'un message lisible s'affiche avec un bouton de reprise, et non une stack trace.

---

## Phase 2 — Granularité opérationnelle (séances, heures, contrôles rattachés au bon niveau)

- [ ] **2.1** — Prompt : *"Ajoute à `seances` les colonnes `heure_debut`, `heure_fin` (time), `mode` (présentiel/distance), `objectif_operationnel` (text), `duree_realisee` (numeric, nullable), `a_prevoir_prochaine_seance` (text, nullable). Réécris complètement `createSeancesForGroupe` : elle doit permettre de créer une nouvelle séance à tout moment (pas seulement une fois par module), avec sélection du bloc horaire (matin 8h30-13h30 ou soir 13h30-18h30, avec possibilité de scinder en deux sous-créneaux), pas une génération automatique unique bloquée après le premier appel."*
  **Test** : crée trois séances successives sur le même couple groupe+module à des dates différentes, vérifie qu'aucune n'écrase la précédente.
- [ ] **2.2** — Prompt : *"Crée une vue ou une fonction SQL qui calcule le cumul d'heures réalisées par couple groupe+module, à partir de la somme des `duree_realisee` des séances au statut 'fait'. Modifie `RailDeProgression` pour afficher ce cumul en heures (ex. '72h / 110h') plutôt qu'un simple pourcentage de séances cochées."*
  **Test** : marque 3 séances de durées différentes comme réalisées, vérifie que le cumul affiché correspond à la somme exacte.
- [ ] **2.3** — Prompt : *"Ajoute à `controles` les colonnes `groupe_id` (obligatoire, référence groupes), `type` (CC/EFM), `type_efm` (local/régional, nullable si type=CC), `date_prevue` (nullable), `date_administration` (nullable), `format` (théorique/pratique/mixte). Modifie toutes les requêtes de génération et de préparation de contrôle pour filtrer par couple groupe+module, jamais par module seul."*
  **Test** : crée un contrôle pour DES101 sur M106, vérifie qu'il n'apparaît pas dans la liste des contrôles de DES102 sur ce même module.
- [ ] **2.4** — Prompt : *"Crée la migration `015_fiches_operationnelles.sql` : renomme la table actuelle `fiches_preparation` en `fiches_prescrites_legacy` (à supprimer plus tard une fois la Phase 1 validée), crée une nouvelle table `fiches_preparation` avec `id, seance_id (référence unique vers seances), contenu text, version integer`. Une fiche de préparation est désormais rattachée à une séance précise, pas à un module."*
  **Test** : génère une fiche pour une séance de 2h30, vérifie qu'elle reste propre à cette séance et n'apparaît pas sur une autre séance du même module.

---

## Phase 3 — Interface formateur (fiches, contrôles, calendrier, masse horaire)

- [ ] **3.1** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : réécris le prompt système de `/api/generate/fiche-preparation` pour produire un aide-mémoire synthétique (mots-clés, idées clés, exemples, points de vigilance) — jamais un déroulé minuté détaillé. Contrains explicitement la longueur (ex. maximum 400 mots) pour éviter que le modèle déborde vers un texte développé. La génération doit s'appuyer sur la fiche prescrite et les suggestions pédagogiques de la compétence, le contenu déjà réalisé sur ce couple groupe+module, et la durée exacte de la séance."*
  **Test** : génère une fiche pour une séance de 2h30, vérifie que le résultat est un schéma court (mots-clés/exemples), pas un texte développé avec des blocs minutés.
- [ ] **3.2 — Interface** — Prompt : *"Crée une vue de consultation du référentiel officiel (fiche prescrite + suggestions pédagogiques d'une compétence) en divulgation progressive : résumé court par défaut (nom, code, durée, objectif en une phrase), bouton 'Voir le détail complet' qui déplie le contexte de réalisation, critères de performance, éléments de compétence."*
  **Test** : ouvre la fiche de la compétence 6, vérifie que le résumé est visible immédiatement et que le détail ne s'affiche qu'au clic.
- [ ] **3.3** — Prompt : *"Crée une fonction ou vue qui calcule, pour chaque couple groupe+module en cours, le rappel de contrôle à afficher (CC1/CC2/EFM) en fonction du cumul d'heures réalisées (2.2) rapporté à la masse horaire allouée (1.6) — seuil réactif à 30h sur un module de durée standard, proportionnel sur les modules plus courts. Ce rappel n'est qu'une notification affichée, il ne déclenche jamais de génération automatique."*
  **Test** : fais avancer un module fictif de faible durée totale (ex. 25h) jusqu'au seuil proportionnel attendu, vérifie que le rappel apparaît au bon moment.
- [ ] **3.4 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : crée l'interface de préparation de contrôle en parcours guidé par étapes (indicateur 'Étape X sur 4') : (1) affichage du contenu couvert — partiel pour un CC (séances réalisées à date), complet pour un EFM (toutes les séances du module) ; (2) choix du format par le formateur (théorique/pratique/mixte) ; (3) assistance IA à la demande pour générer questions/barème/corrigé, tout éditable ; (4) relecture et validation finale."*
  **Test** : prépare un CC puis un EFM sur le même module, vérifie que le contenu de référence affiché diffère bien (partiel vs complet).
- [ ] **3.5 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md : crée la page `/calendrier` avec les blocs matin (8h30-13h30) et soir (13h30-18h30), pause interne visible en pointillés. Affiche les dates de contrôle CC1/CC2/EFM local en bordure pointillée (estimées), et permet la saisie manuelle de la date d'EFM régional (bordure pleine une fois saisie) avec les deux champs associés (date d'envoi des propositions, date de l'épreuve)."*
  **Test** : vérifie visuellement la distinction pointillé/plein sur un module EFML et un module EFMR.
- [ ] **3.6** — Prompt : *"Ajoute le suivi cumulatif des heures dispensées par le formateur (semaine/mois/année), avec distinction heures normales/supplémentaires, et alerte si le cumul approche 910h/an, 30h supplémentaires/mois, ou 260h supplémentaires/an."*
  **Test** : simule un cumul dépassant 25h sur une semaine, vérifie que l'alerte se déclenche au bon seuil.
- [ ] **3.7** — Prompt : *"Ajoute les rappels calendaires liés aux échéances réglementaires : restitution de notes CC à la 2ème séance suivante, préparation EFM à J-20 avant validation commission, restitution EFM à J+10, affichage résultats à J+15."*
  **Test** : crée un CC avec une date de séance suivante connue, vérifie qu'un rappel apparaît à la bonne échéance.

---

## Phase 4 — Espace stagiaire (compte authentifié obligatoire, mobile-first)

- [ ] **4.1** — Prompt : *"Ajoute `'stagiaire'` aux rôles acceptés dans `profils.role`. Lie chaque `stagiaire` à une ligne `auth.users` (compte email/mot de passe). Supprime toute logique reposant sur `token_public` pour l'accès aux groupes et aux contrôles — la passation et la consultation se font uniquement via le compte stagiaire authentifié, jamais par lien public."*
  **Test** : crée un compte stagiaire test, connecte-toi, vérifie l'accès aux données de son propre groupe uniquement (pas celles d'un autre groupe).
- [ ] **4.2 — Interface** — Prompt : *"En respectant strictement docs/design_system.md et docs/conventions.md (section Espace stagiaire mobile-first) : crée le layout `/espace-stagiaire` avec barre de navigation inférieure fixe (Fil / Devoirs / Contrôles / Emploi du temps), cibles tactiles 44px minimum."*
  **Test** : ouvre sur un viewport mobile (375px), vérifie que la barre inférieure est utilisable au pouce.
- [ ] **4.3 — Interface** — Prompt : *"En respectant strictement docs/design_system.md : transforme les annonces en fil d'actualité pour les stagiaires — cartes empilées pleine largeur, commentaires, réaction 'j'aime' toujours visibles en bas de carte, mention `@camarade` avec autocomplétion."*
  **Test** : publie une annonce côté formateur, vérifie qu'elle apparaît dans le fil du stagiaire avec les actions commentaire/j'aime fonctionnelles.
- [ ] **4.4** — Prompt : *"Crée la fonctionnalité 'devoirs' : table `devoirs` (id, seance_id ou module_id, titre, description, date_echeance, type_rendu texte/fichier/lien), table `devoirs_rendus` (devoir_id, stagiaire_id, contenu, date_rendu, statut). Interface formateur pour assigner un devoir, interface stagiaire pour le consulter et le rendre."*
  **Test** : assigne un devoir test, rends-le depuis un compte stagiaire, vérifie que le formateur voit le rendu.
- [ ] **4.5 — Interface** — Prompt : *"Crée la page Contrôles côté stagiaire (accessible depuis le compte authentifié) listant les contrôles de son groupe par module, avec passation directe."*
  **Test** : un stagiaire connecté peut passer un contrôle actif de son groupe sans lien externe.
- [ ] **4.6 — Interface** — Prompt : *"Crée la page Emploi du temps côté stagiaire, affichant les séances de son groupe et les dates de contrôle."*
  **Test** : vérifie que l'emploi du temps affiché correspond aux séances réellement planifiées du groupe du stagiaire connecté.
- [ ] **4.7** — Prompt : *"Ajoute la possibilité de poser une question sur un support de cours consulté, avec mention `@camarade` possible dans la question ou la réponse. Conserve ces questions en archive pluriannuelle (table dédiée, sans mécanisme de réutilisation automatique pour l'instant)."*
  **Test** : pose une question sur un support test, vérifie qu'elle est bien rattachée au support et visible par le formateur.

---

## Phase 5 — Fonctionnalités périphériques

- [ ] **5.1** — Prompt : *"Crée la génération de support de cours 16:9 (diaporama) alignée sur le contenu de la fiche de préparation d'une séance, pour les modules sans cours existant."*
  **Test** : génère un support pour une séance test, vérifie le format 16:9 et la cohérence avec la fiche de préparation associée.
- [ ] **5.2** — Prompt : *"Ajoute la prise de présence par séance (liste des absents), avec vue agrégée du taux de présence par stagiaire sur un module."*
  **Test** : marque 2 stagiaires absents sur une séance, vérifie le calcul du taux de présence cumulé.
- [ ] **5.3** — Prompt : *"Ajoute le calendrier des jours fériés/vacances OFPPT (saisie manuelle), l'emploi du temps personnel du formateur, et la déclaration d'absence (maladie) visible dans le calendrier."*
  **Test** : déclare une absence sur une date test, vérifie qu'elle apparaît visuellement dans le calendrier.
- [ ] **5.4** — Prompt : *"Crée le module stage/soutenance (compétence 16) : suivi du stage (dates, entreprise, tuteur), dépôt des documents (contrat, attestation, note tuteur), les deux grilles de notation (Rapport /20 : présentation /8 + contenu /12 ; Exposé /20 : fond /14 + forme /6) avec noms du jury."*
  **Test** : saisis un stage test avec ses deux grilles de notation, vérifie l'affichage correct des sous-totaux.
- [ ] **5.5** — Prompt : *"Crée l'export 'classeur pédagogique' : regroupe les fiches de préparation d'un module/groupe sur une période en un document PDF téléchargeable, dans un format proche du cahier du formateur papier."*
  **Test** : exporte un mois de fiches pour un groupe test, vérifie la lisibilité et la complétude du PDF.

---

## Phase 6 — Déploiement

- [ ] **6.1** — Terminal : `vercel`, variables d'environnement Supabase + clé API IA dans le dashboard Vercel.
  **Test** : connecte-toi en formateur et en stagiaire depuis l'URL de production, vérifie que les deux espaces fonctionnent.

---

Traite les phases dans l'ordre. Ne commence jamais une interface (Phase 3-4) avant que le schéma correspondant (Phase 1-2) soit validé — c'est ce qui a causé la dérive du premier prototype.