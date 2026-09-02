-- §3 — Code opérationnel dérivé du cycle, et §4.1 — type d'EFM porté par
-- l'assignation groupe+module.

-- ── §3 ────────────────────────────────────────────────────────────────────
--
-- `code_operationnel` était une colonne saisie à l'import, remplie selon
-- l'ancien pattern « M1 + numéro de compétence » pour les seize compétences.
-- Les huit de spécialisation portaient donc M109…M116 au lieu de M201…M208 :
-- faux dès qu'un module de 2ᵉ année est assigné à un groupe.
--
-- Le code se déduit désormais du cycle et du rang de la compétence *dans son
-- cycle*, pas de son numéro absolu — un programme dont le tronc commun ne
-- ferait pas exactement huit compétences reste correct. Une colonne de
-- surcharge garde la porte ouverte aux modules hors pattern, EGTSI106 et les
-- transversaux à venir.

alter table public.competences
  add column if not exists rang_cycle smallint,
  add column if not exists code_operationnel_surcharge text;

update public.competences c
   set rang_cycle = r.rang
  from (
    select id,
           row_number() over (
             partition by programme_id, cycle order by numero
           )::smallint as rang
      from public.competences
  ) r
 where r.id = c.id
   and c.rang_cycle is distinct from r.rang;

alter table public.competences
  alter column rang_cycle set not null;

create or replace function public.code_operationnel_derive(
  p_cycle text,
  p_rang smallint
)
returns text
language sql
immutable
as $$
  select case p_cycle
    when 'tronc_commun' then 'M1'
    when 'specialisation' then 'M2'
    else 'M'
  end || lpad(p_rang::text, 2, '0');
$$;

-- La colonne de lecture ne change ni de nom ni de type : tout le code qui
-- lit `code_operationnel` continue de fonctionner sans savoir qu'elle est
-- désormais calculée.
alter table public.competences drop column code_operationnel;
alter table public.competences
  add column code_operationnel text
  generated always as (
    coalesce(
      code_operationnel_surcharge,
      public.code_operationnel_derive(cycle, rang_cycle)
    )
  ) stored;

comment on column public.competences.code_operationnel is
  'Code court du quotidien, dérivé du cycle et du rang dans le cycle. '
  'Pour un module hors pattern (EGTSI106, transversaux), renseigner '
  'code_operationnel_surcharge.';

-- ── §4.1 ──────────────────────────────────────────────────────────────────
--
-- Le type d'EFM ne vivait que sur `controles`, c'est-à-dire une fois
-- l'épreuve créée. Il sert d'abord à planifier : un module à EFM régional a
-- une date imposée par la Direction Régionale, donc il se démarre en
-- priorité. L'information appartient à l'assignation du module au groupe,
-- au même titre que la masse horaire.
--
-- Volontairement nullable : « pas encore renseigné » est un état réel au
-- moment où l'on assigne un module, et le prétendre local par défaut
-- masquerait justement les EFMR qu'on cherche à faire ressortir.

alter table public.groupe_modules
  add column if not exists type_efm text;

alter table public.groupe_modules
  drop constraint if exists groupe_modules_type_efm_check;
alter table public.groupe_modules
  add constraint groupe_modules_type_efm_check
  check (type_efm is null or type_efm in ('local', 'regional'));

comment on column public.groupe_modules.type_efm is
  'local | regional | null (non renseigné). Un EFM régional a une date '
  'imposée par la Direction Régionale : ces modules se programment en '
  'priorité dans l''année.';
