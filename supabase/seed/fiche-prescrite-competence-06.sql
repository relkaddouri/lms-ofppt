-- fiche-prescrite-competence-06.sql — Atome 1.2
--
-- Fiche prescrite de la compétence 6 « Déterminer les concepts de l'UX / UI Design »
-- (code DIA_DES_TS-06), extraite de docs/programme-ux-designer.docx.
--
-- Réserve : le document ne lettre pas ses éléments de compétence. Les lettres
-- A à D sont dérivées de leur ordre d'apparition dans la fiche.
--
-- Idempotent : rejouable sans dupliquer.

insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
select c.id, 'En équipe
À partir :
D’ateliers
De méthodologies
À l’aide :
D’outils de maquettage
D’outil de mise en forme de tableaux
De lois d’UX Design
Du cahier des charges', 'Maîtrise des outils de mise en forme
Attitude empathique envers les utilisateurs
Précision claire des données collectées
Organisation visuelle pertinente
Respect des codes graphiques'
from public.competences c where c.code_officiel = 'DIA_DES_TS-06'
on conflict (competence_id) do update
  set contexte_realisation = excluded.contexte_realisation,
      criteres_generaux_performance = excluded.criteres_generaux_performance;

insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
select f.id, 'A', 'Maitriser la méthodologie UX', 1
from public.fiches_prescrites f
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06'
on conflict (fiche_prescrite_id, ordre) do update
  set lettre = excluded.lettre, intitule = excluded.intitule;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Connaissances abouties des principes d’ergonomie', 1
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 1
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Compréhension adaptée des objectifs de l’UX', 2
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 1
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Respect des règles de l’UX', 3
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 1
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Application pertinente des lois', 4
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 1
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Méthodologie centrée sur les utilisateurs', 5
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 1
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Réalisation correcte des ateliers', 6
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 1
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Respect de la séquence des exercices', 7
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 1
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Mise en pratiques efficace des méthodes d’évaluation', 8
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 1
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
select f.id, 'B', 'Mener une recherche utilisateurs', 2
from public.fiches_prescrites f
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06'
on conflict (fiche_prescrite_id, ordre) do update
  set lettre = excluded.lettre, intitule = excluded.intitule;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Attitude empathique', 1
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 2
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Appréhension juste des utilisateurs', 2
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 2
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Respect des délais', 3
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 2
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Respect des techniques de travail', 4
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 2
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Clarté des documents', 5
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 2
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Maîtrise du processus de conception', 6
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 2
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Création adaptée de zonings et de wireframes cohérents', 7
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 2
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
select f.id, 'C', 'Définir les parcours utilisateur', 3
from public.fiches_prescrites f
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06'
on conflict (fiche_prescrite_id, ordre) do update
  set lettre = excluded.lettre, intitule = excluded.intitule;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Identification complète des typologies d’utilisation de la solution', 1
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 3
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Création de scénarios d’usage complets', 2
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 3
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Parcours utilisateurs cohérents avec le story mapping', 3
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 3
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Arborescence du parcours complète', 4
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 3
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Proposition d’axes d’amélioration pertinents', 5
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 3
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Création de zonings dans le respect du parcours utilisateurs', 6
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 3
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Création de wireframes cohérents avec l’utilisation des utilisateurs', 7
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 3
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
select f.id, 'D', 'Créer les éléments graphiques de l’interface utilisateur', 4
from public.fiches_prescrites f
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06'
on conflict (fiche_prescrite_id, ordre) do update
  set lettre = excluded.lettre, intitule = excluded.intitule;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Utilisation correcte des logiciels', 1
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 4
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Clarté du guide de style', 2
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 4
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;

insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
select e.id, 'Délimitation précise des éléments graphiques', 3
from public.elements_competence e
join public.fiches_prescrites f on f.id = e.fiche_prescrite_id
join public.competences c on c.id = f.competence_id
where c.code_officiel = 'DIA_DES_TS-06' and e.ordre = 4
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
