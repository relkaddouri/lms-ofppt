-- 013_competences_cycle.sql
--
-- Ajoute le cycle de formation à chaque compétence : tronc commun (1re année)
-- ou spécialisation (2e année), conformément au PRD §3 (« Groupe → Année :
-- 1ère année tronc commun / 2ème année spécialisation »).
--
-- Cette information N'EST PAS déductible du code officiel : le référentiel
-- attribue par exemple DIA_DESOUX_TS-08 à la compétence 08 alors qu'elle
-- relève du tronc commun. Le préfixe DESOUX n'encode donc pas le cycle, d'où
-- une colonne explicite.
--
-- Nullable à dessein : une autre spécialité pourra être importée sans que son
-- découpage soit connu d'avance (atome 1.4).

alter table public.competences
  add column if not exists cycle text;

alter table public.competences
  drop constraint if exists competences_cycle_check;

alter table public.competences
  add constraint competences_cycle_check
  check (cycle is null or cycle in ('tronc_commun', 'specialisation'));

comment on column public.competences.cycle is
  'tronc_commun (1re annee) ou specialisation (2e annee). Non deductible du '
  'code officiel : renseigne d apres la repartition reelle de la filiere.';
