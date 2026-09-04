-- Fiche de préparation et support partagés entre groupes parallèles (§4.3bis).
--
-- Deux groupes de tronc commun au même point du programme — DES101 et DES102
-- sur M104 — couvrent un contenu strictement identique. Regénérer une fiche
-- par groupe gaspille du temps et des appels au modèle, et laisse deux
-- versions diverger dès que l'une est corrigée et pas l'autre.
--
-- Piste retenue après mesure : une séance « miroir » pointe vers la séance
-- qui porte le contenu, plutôt qu'une relation plusieurs-à-plusieurs. Seize
-- endroits lisent ou écrivent une fiche en supposant une relation un-à-un
-- avec sa séance ; la table de liaison les aurait tous restructurés, le
-- pointeur en dérèfle neuf d'une ligne chacun.
--
-- Ce qui n'est jamais partagé reste sur la séance : présences, remarques,
-- date, horaires, statut. Et les contrôles ne suivent pas cette règle — c'est
-- une exception explicite du PRD, pas un oubli.

alter table public.seances
  add column if not exists contenu_source_id uuid
    references public.seances(id) on delete set null;

create index if not exists seances_contenu_source
  on public.seances (contenu_source_id);

comment on column public.seances.contenu_source_id is
  'Séance qui porte la fiche et le support de celle-ci. Null quand la séance '
  'porte son propre contenu. Ne concerne jamais les présences, les remarques, '
  'ni les contrôles (§4.3bis).';

-- ── Pas de chaîne, pas de boucle ──────────────────────────────────────────
--
-- Un miroir qui pointe vers un miroir obligerait chaque lecture à remonter
-- une chaîne de longueur inconnue. Une seule indirection, toujours.

create or replace function public.verifie_contenu_source()
returns trigger
language plpgsql
as $$
begin
  if new.contenu_source_id is null then
    return new;
  end if;

  if new.contenu_source_id = new.id then
    raise exception 'Une séance ne peut pas être sa propre source de contenu.';
  end if;

  if exists (
    select 1 from public.seances
    where id = new.contenu_source_id and contenu_source_id is not null
  ) then
    raise exception
      'Cette séance suit déjà une autre séance : liez-vous à celle qui porte le contenu.';
  end if;

  if exists (select 1 from public.seances where contenu_source_id = new.id) then
    raise exception
      'Des séances suivent déjà celle-ci : elle ne peut pas suivre une autre séance.';
  end if;

  return new;
end;
$$;

drop trigger if exists seances_contenu_source_simple on public.seances;
create trigger seances_contenu_source_simple
  before insert or update of contenu_source_id on public.seances
  for each row execute function public.verifie_contenu_source();

-- ── Supprimer la source ne doit pas vider les miroirs ─────────────────────
--
-- `on delete set null` détacherait les miroirs en leur laissant une fiche qui
-- n'existe plus nulle part : le contenu disparaîtrait de deux groupes pour la
-- suppression d'une séance d'un seul. Le contenu passe donc au premier miroir,
-- qui devient la nouvelle source, et les autres le suivent.

create or replace function public.transmettre_contenu_partage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_heritier uuid;
begin
  select id into v_heritier
  from public.seances
  where contenu_source_id = old.id
  order by date nulls last, created_at
  limit 1;

  if v_heritier is null then
    return old;
  end if;

  -- L'héritier devient source : il reprend les fiches et les supports, puis
  -- les autres miroirs le suivent.
  update public.seances set contenu_source_id = null where id = v_heritier;
  update public.fiches_preparation set seance_id = v_heritier where seance_id = old.id;
  update public.supports_seance set seance_id = v_heritier where seance_id = old.id;
  update public.seances
     set contenu_source_id = v_heritier
   where contenu_source_id = old.id and id <> v_heritier;

  return old;
end;
$$;

drop trigger if exists seances_transmettre_contenu on public.seances;
create trigger seances_transmettre_contenu
  before delete on public.seances
  for each row execute function public.transmettre_contenu_partage();
