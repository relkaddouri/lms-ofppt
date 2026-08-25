-- 016_modules_pont_competences.sql — Atome 1.5
--
-- La table `modules` est conservée : elle reste le pont opérationnel entre le
-- quotidien du formateur (séances, fiches, contrôles, assignations de groupe)
-- et le référentiel national introduit en 1.1.
--
-- Deux changements :
--   1. competence_id relie le module à sa compétence du référentiel.
--   2. duree_heures devient duree_reference, pour lever l'ambiguïté avec la
--      masse horaire réellement allouée par groupe (atome 1.6), qui est la
--      seule valeur opérante.

alter table public.modules
  add column if not exists competence_id uuid
  references public.competences(id) on delete set null;

create index if not exists modules_competence_id_idx
  on public.modules (competence_id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'modules'
      and column_name = 'duree_heures'
  ) then
    alter table public.modules rename column duree_heures to duree_reference;
  end if;
end;
$$;

comment on table public.modules is
  'Pont operationnel entre le referentiel national (competences) et le '
  'quotidien du formateur. Un module peut exister sans competence rattachee.';
comment on column public.modules.competence_id is
  'Competence du referentiel dont ce module est la declinaison operationnelle. '
  'Null tant que le rattachement n a pas ete fait.';
comment on column public.modules.duree_reference is
  'Duree indicative, simple repere. Ce n est PAS la masse horaire reelle : '
  'celle-ci est portee par le couple groupe+module (groupe_modules), et peut '
  'differer d un groupe a l autre.';
