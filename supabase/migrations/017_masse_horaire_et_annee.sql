-- 017_masse_horaire_et_annee.sql — Atome 1.6
--
-- La masse horaire réellement dispensée n'est pas une propriété du module :
-- elle appartient au couple groupe+module. Le même module peut valoir 110 h
-- pour un groupe et 85 h pour un autre (PRD §4.1). C'est cette valeur, et non
-- duree_reference, qui fait foi pour la progression et le seuil de contrôle.

alter table public.groupe_modules
  add column if not exists masse_horaire_allouee numeric,
  add column if not exists formateur_id uuid
    references public.profils(id) on delete set null;

-- Reprise : une assignation existante démarre sur la durée de référence du
-- module, que le formateur ajuste ensuite (atome 1.7).
update public.groupe_modules gm
set masse_horaire_allouee = m.duree_reference
from public.modules m
where m.id = gm.module_id and gm.masse_horaire_allouee is null;

alter table public.groupe_modules
  alter column masse_horaire_allouee set not null;

alter table public.groupe_modules
  drop constraint if exists groupe_modules_masse_horaire_check;
alter table public.groupe_modules
  add constraint groupe_modules_masse_horaire_check
  check (masse_horaire_allouee >= 0);

comment on column public.groupe_modules.masse_horaire_allouee is
  'Masse horaire reellement allouee a ce module POUR CE GROUPE. Seule valeur '
  'operante. Distincte de modules.duree_reference, simple repere national.';
comment on column public.groupe_modules.formateur_id is
  'Formateur responsable de ce module pour ce groupe. Un groupe peut avoir '
  'plusieurs formateurs, chacun sur un sous-ensemble de modules (PRD 4.1).';

create index if not exists groupe_modules_formateur_id_idx
  on public.groupe_modules (formateur_id);


-- ---------------------------------------------------------------- groupes

alter table public.groupes
  add column if not exists annee integer,
  add column if not exists specialite_id uuid
    references public.specialites(id) on delete set null;

alter table public.groupes drop constraint if exists groupes_annee_check;
alter table public.groupes
  add constraint groupes_annee_check
  check (annee is null or annee in (1, 2));

-- La spécialité n'a de sens qu'en 2e année : la 1re est un tronc commun.
alter table public.groupes drop constraint if exists groupes_specialite_si_annee2;
alter table public.groupes
  add constraint groupes_specialite_si_annee2
  check (annee is distinct from 2 or specialite_id is not null);

comment on column public.groupes.annee is
  '1 = tronc commun, 2 = specialisation. Nullable tant que le groupe n a pas '
  'ete qualifie ; la contrainte n impose la specialite que pour l annee 2.';
comment on column public.groupes.specialite_id is
  'Specialite suivie en 2e annee. Obligatoire des que annee vaut 2.';
