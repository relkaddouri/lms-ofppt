-- 021_controles_groupe_et_type.sql — Atome 2.3
--
-- Un contrôle appartenait au module seul : le même contrôle apparaissait pour
-- tous les groupes suivant ce module, alors que le périmètre d'un CC est
-- « ce que CE groupe a réellement vu jusqu'ici » (PRD §4.7). Il est désormais
-- rattaché au couple groupe+module.
--
-- Typologie ajoutée en même temps : CC ou EFM, et pour un EFM, local ou
-- régional — distinction qui détermine si la date peut être estimée par l'app
-- ou doit être saisie à réception d'une communication de la Direction (§4.9).

alter table public.controles
  add column if not exists groupe_id uuid references public.groupes(id) on delete cascade,
  add column if not exists type text not null default 'CC',
  add column if not exists type_efm text,
  add column if not exists date_prevue date,
  add column if not exists date_administration date,
  add column if not exists format text not null default 'theorique';

-- La table est vide à ce stade : aucune reprise n'est nécessaire, et groupe_id
-- peut devenir obligatoire directement.
alter table public.controles alter column groupe_id set not null;

alter table public.controles drop constraint if exists controles_type_check;
alter table public.controles
  add constraint controles_type_check check (type in ('CC', 'EFM'));

alter table public.controles drop constraint if exists controles_type_efm_check;
alter table public.controles
  add constraint controles_type_efm_check
  check (type_efm is null or type_efm in ('local', 'regional'));

-- Un EFM est forcément local ou régional ; un CC n'a pas de sous-type.
alter table public.controles drop constraint if exists controles_efm_qualifie;
alter table public.controles
  add constraint controles_efm_qualifie
  check (
    (type = 'EFM' and type_efm is not null)
    or (type = 'CC' and type_efm is null)
  );

alter table public.controles drop constraint if exists controles_format_check;
alter table public.controles
  add constraint controles_format_check
  check (format in ('theorique', 'pratique', 'mixte'));

create index if not exists controles_groupe_module_idx
  on public.controles (groupe_id, module_id);

comment on column public.controles.groupe_id is
  'Groupe concerne. Le perimetre d un CC est ce que CE groupe a vu, pas ce que '
  'le module couvre en general.';
comment on column public.controles.type is
  'CC (controle continu) ou EFM (epreuve de fin de module).';
comment on column public.controles.type_efm is
  'local ou regional. Un EFM regional voit sa date fixee par la Direction '
  'Regionale : elle ne peut jamais etre estimee par l application.';
comment on column public.controles.date_prevue is
  'Date estimee ou planifiee. Pour un EFM regional, saisie manuellement.';
comment on column public.controles.date_administration is
  'Date reelle de passation, renseignee apres coup.';
comment on column public.controles.format is
  'theorique, pratique ou mixte. Choisi par le formateur, jamais par l app.';
