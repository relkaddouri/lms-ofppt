-- Proposition de correction d'un travail pratique (PRD §4.4).
--
-- Deux règles du PRD tiennent à ce fichier, et toutes deux sont posées ici
-- plutôt que dans la route qui génère : une règle qui protège un contenu
-- pédagogique ne doit pas tomber avec un bug d'appel.
--
-- 1. La correction n'existe qu'après coup. « Disponible pour le formateur au
--    moment où il marque la séance correspondante comme terminée — pas
--    générée à l'avance. » Un trigger refuse l'écriture tant que la séance
--    n'est pas faite, et tant qu'elle n'est pas pratique.
--
-- 2. Elle n'est jamais exposée aux stagiaires. Contrairement à
--    `supports_seance`, cette table n'a **aucune** politique de lecture pour
--    le stagiaire : l'absence de politique vaut refus sous RLS. C'est
--    volontairement plus strict que le PRD, qui interdit l'exposition « avant
--    que le TP soit fait » sans dire ce qu'il en est après — ouvrir plus tard
--    s'ajoute, se rétracter ne se peut pas.

create table if not exists public.corrections_tp (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances (id) on delete cascade,
  contenu jsonb not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  unique (seance_id, version)
);

create index if not exists idx_corrections_tp_seance
  on public.corrections_tp (seance_id, version desc);

comment on table public.corrections_tp is
  'Proposition de correction d''un TP (PRD §4.4). Réservée au formateur : aucune politique de lecture stagiaire, et c''est délibéré.';

-- ── La séance doit être pratique, et faite ────────────────────────────────

create or replace function public.verifie_correction_tp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
  v_nature text;
begin
  select statut, nature into v_statut, v_nature
  from public.seances where id = new.seance_id;

  if v_nature is distinct from 'pratique' then
    raise exception 'Une correction ne se rattache qu''à une séance pratique.';
  end if;
  if v_statut is distinct from 'fait' then
    raise exception 'La correction n''est disponible qu''une fois la séance marquée comme faite.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_verifie_correction_tp on public.corrections_tp;
create trigger trg_verifie_correction_tp
  before insert or update on public.corrections_tp
  for each row execute function public.verifie_correction_tp();

-- ── RLS : le formateur de la séance, et personne d'autre ──────────────────

alter table public.corrections_tp enable row level security;

drop policy if exists "corrections_tp_proprietaire" on public.corrections_tp;
create policy "corrections_tp_proprietaire" on public.corrections_tp
  for all to authenticated
  using (peut_acceder_seance(seance_id))
  with check (peut_acceder_seance(seance_id));
