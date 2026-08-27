-- suggestions-pedagogiques-competence-06.sql — Atome 1.3
--
-- Suggestions pédagogiques de la compétence 6 « Déterminer les concepts de
-- l'UX / UI Design » (DIA_DES_TS-06), extraites de docs/programme-ux-designer.docx.
--
-- Réserves consignées :
--   * Réserve levée (migration 028) : le programme étiquetait « B.3 » et « B.4 » deux
--     apprentissages placés sous l'élément C. Faute de seconde source, ils avaient été
--     conservés tels quels. Le manuel de formateur de la compétence 6 les nomme C.3 et
--     C.4 : la coquille est dans le programme, les codes sont corrigés ici.
--   * Une cellule d'activités d'apprentissage sans apprentissage associé apparaît dans
--     le groupe C ; elle est recollée aux activités du premier apprentissage de C.
--   * Durée suggérée et activités ne sont portées que par le premier apprentissage de
--     chaque élément, comme dans le référentiel. Somme : 15 + 30 + 15 + 40 = 100 %.
--
-- Idempotent : rejouable sans dupliquer.

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'A.1', 'Définir l’UX Design', 'Usages de l’UX Design dans les solutions digitales
Lien entre marketing digital et solutions d’UX Design
Définition des lois d’UX Design comme la loi de Fitts, loi de Hick et la loi de proximité', 'Seul ou en groupe
A partir de consignes et de méthodologies définie selon une approche par projet/problème, exercices d’application selon les éléments suivants :
Détailler les méthodologies
Effectuer un projet en groupe : analyses quantitatives et qualitatives, tri par cartes (6 to 1)', 15.0, 1
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'A'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'A.2', 'Présenter les méthodes et ateliers d’UX Design utilisés lors d’un projet', 'Méthodologie au Design thinking
Présentation de la méthode itérative
Méthode de tri par cartes et de 6 to 1
Différentiation entre évaluations quantitatives (sondages et A/B testing) et qualitatives (interview et tests d’utilisation)', null, null, 2
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'A'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'B.1', 'Analyser l’existant sur les utilisateurs', 'Déterminer les clients ciblés
Analyser les données marketing relatives à l’utilisation des services / produits
Analyser les données chiffrées sur l’utilisation de la solution digitale si elle existe déjà', 'Présentation des différentes méthodes quantitatives et qualitatives d’analyse utilisateurs
Fournir différents documents collectant diverses données des utilisateurs d’un client
Créer un document organisé présentant un récapitulatifs des données pertinentes
Analyser les données en établissant un lien avec le projet et la solution digitale
Créer des personas à partir des données recueillies
Produire des user stories et des empathy maps sur la base des personas', 30.0, 1
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'B'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'B.2', 'Déterminer les utilisateurs de la solution digitale', 'Création de fiches personas pour créer les segments d’utilisateurs selon des caractéristiques (psychologiques, sociétales ainsi que d’autres caractéristiques des utilisateurs)
Production de user stories et d’empathy maps afin de personnaliser de manière pertinente les parcours des utilisateurs', null, null, 2
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'B'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'C.1', 'Identifier des parcours utilisateurs', 'Présentation des typologies de parcours utilisateurs (acheteur, expérience magasin)
Réalisation de scénarios d’usage', 'Seul ou en groupe selon des consignes fournis dans le cadre des exercices de mise en application
Selon une approche par projet/problème issu d’un projet réel ou fictif, réalisation d’exercices d’application :
scénario d’usage, story mapping
Réaliser une arborescence et un parcours utilisateur
Tester le parcours en notifiant les points de vigilance en termes d’accessibilité et de trouvabilité
Réaliser en groupe des zoning papier puis des wireframes
Seul ou en équipe selon instructions du formateur
A partir d’un brief
A l’aide de recherches internet, d’outil de PAO, de veille graphique
Débuter par de la théorie sur les règles et codes du design graphique
A partir du brief :
Effectuer des recherches graphiques
Réaliser un moodboard d’inspiration afin d’orienter la création de l’identité visuelle
Choisir une piste graphique et effectuer des choix de couleurs, de typographies et d’éléments graphiques
Justifier ses choix graphiques', 15.0, 1
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'C'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'C.2', 'Créer des parcours utilisateurs', 'Création de story mapping permettant de définir précisément le besoin utilisateur au regard de la solution digitale.
Création de différents parcours utilisateurs issu du story mapping
Création de l’arborescence du parcours utilisateurs qui détermine le chemin de l’utilisateur', null, null, 2
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'C'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'C.3', 'Relever des points d’amélioration', 'Analyse du parcours utilisateurs qui permette d’identifier les points d’amélioration
Règles d’accessibilité et de trouvabilité', null, null, 3
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'C'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'C.4', 'Maquetter le parcours', 'Création de zoning pour concevoir une vue schématique du parcours utilisateur
Création de wireframes qui révèle une vue plus détaillée du parcours utilisateur', null, null, 4
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'C'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'D.1', 'Identifier les éléments à designer dans la solution digitale', 'Formalisation des choix graphiques dans la charte graphique
Application de l’identité visuelle définie dans la charte graphique et validée par le client', 'Seul
A partir de documentation proposée par le formateur et de consignes
A l’aide d’outil de maquettage, de recherches graphiques
Quizz d’activités sur l’identification des éléments graphiques d’une interface
Exercice d’application :
Créer une page d’accueil selon le wireframe
Placer le contenu de manière pertinente vis-à-vis des exercices et ateliers sur les utilisateurs et la solution digitale du projet
Réaliser une planche d’éléments UI', 40.0, 1
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'D'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.suggestions_pedagogiques
  (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
select e.id, 'D.2', 'Concevoir la maquette graphique de l’interface utilisateur', 'Utilisation de logiciels de maquettage (Figma, Adobe XD)
Application des codes graphiques définie sur les interfaces de solutions digitales (positionnement des blocs de navigation, contenu, footer…)
Organisation des contenus visuels et textuels qui définissent l’architecture de l’interface utilisateur', null, null, 2
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.lettre = 'D'
on conflict (element_competence_id, ordre) do update
  set code = excluded.code,
      apprentissage_base = excluded.apprentissage_base,
      elements_contenu = excluded.elements_contenu,
      activites_apprentissage = excluded.activites_apprentissage,
      duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
