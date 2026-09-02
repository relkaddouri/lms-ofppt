-- PRD §4.9 — Le motif hebdomadaire récurrent devient le moteur de génération.
--
-- Jusqu'ici le formateur posait chaque date à la main dans le calendrier. Ce
-- n'est pas ainsi qu'il travaille : il déclare une fois son rythme — quel
-- groupe, quel jour, quel créneau — et c'est ce rythme qui place les séances.
--
-- À ne pas confondre avec `rythmes_hebdomadaires`, qui existe déjà et porte
-- tout autre chose : un objectif d'heures par semaine pour le suivi de la
-- charge légale (§4.11). Le nom se ressemble, la fonction non.

create table if not exists public.motifs_hebdomadaires (
  id uuid primary key default gen_random_uuid(),
  formateur_id uuid not null references public.profils(id) on delete cascade,
  libelle text,
  date_debut date not null,
  -- Nulle tant que le motif est le motif courant : il court jusqu'à ce qu'un
  -- suivant le remplace.
  date_fin date,
  created_at timestamptz not null default now(),
  constraint motifs_periode_coherente
    check (date_fin is null or date_fin >= date_debut)
);

create index if not exists motifs_formateur_idx
  on public.motifs_hebdomadaires (formateur_id, date_debut desc);

create table if not exists public.creneaux_motif (
  id uuid primary key default gen_random_uuid(),
  motif_id uuid not null references public.motifs_hebdomadaires(id) on delete cascade,
  -- 1 = lundi … 7 = dimanche, comme `isodow` de Postgres.
  jour_semaine smallint not null check (jour_semaine between 1 and 7),
  heure_debut time not null,
  heure_fin time not null,
  groupe_id uuid not null references public.groupes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint creneau_horaire_coherent check (heure_fin > heure_debut)
);

create index if not exists creneaux_motif_idx
  on public.creneaux_motif (motif_id, jour_semaine, heure_debut);

-- Le module n'est pas dans le motif : le générateur l'attribue depuis les
-- séances déjà planifiées par la répartition horaire, dans leur ordre.

comment on table public.creneaux_motif is
  'Une ligne = un rendez-vous hebdomadaire avec un groupe. Le module vient '
  'de la répartition horaire, pas du motif.';

alter table public.motifs_hebdomadaires enable row level security;
alter table public.creneaux_motif enable row level security;

drop policy if exists "motifs_proprietaire" on public.motifs_hebdomadaires;
create policy "motifs_proprietaire" on public.motifs_hebdomadaires
  for all to authenticated
  using (formateur_id = auth.uid())
  with check (formateur_id = auth.uid());

drop policy if exists "creneaux_motif_proprietaire" on public.creneaux_motif;
create policy "creneaux_motif_proprietaire" on public.creneaux_motif
  for all to authenticated
  using (
    exists (
      select 1 from public.motifs_hebdomadaires m
      where m.id = creneaux_motif.motif_id and m.formateur_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.motifs_hebdomadaires m
      where m.id = creneaux_motif.motif_id and m.formateur_id = auth.uid()
    )
  );

-- Un seul motif courant à la fois : ouvrir le suivant referme le précédent.
create or replace function public.ouvrir_motif(
  p_libelle text,
  p_date_debut date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.motifs_hebdomadaires
     set date_fin = p_date_debut - 1
   where formateur_id = auth.uid()
     and date_fin is null
     and date_debut < p_date_debut;

  insert into public.motifs_hebdomadaires (formateur_id, libelle, date_debut)
  values (auth.uid(), nullif(trim(coalesce(p_libelle, '')), ''), p_date_debut)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.ouvrir_motif(text, date) from public, anon;
grant execute on function public.ouvrir_motif(text, date) to authenticated;
