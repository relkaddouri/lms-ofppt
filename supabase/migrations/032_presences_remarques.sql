-- 032 — Présences et remarques d'une séance.
--
-- Le cahier du formateur tient en trois choses : ce qui était prévu (la fiche),
-- qui était là, et ce qu'il faut retenir pour la suite. Les deux dernières
-- manquaient.

create table if not exists public.presences (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances (id) on delete cascade,
  stagiaire_id uuid not null references public.stagiaires (id) on delete cascade,
  present boolean not null default true,
  -- Renseigné seulement en cas d'absence : « justifiée », « retard »…
  motif text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seance_id, stagiaire_id),
  constraint motif_seulement_si_absent
    check (present = true or motif is null or length(trim(motif)) > 0)
);

comment on table public.presences is
  'Appel d''une séance. Une ligne par stagiaire présent ou absent ; l''absence de ligne signifie appel non fait.';

create index if not exists presences_seance_idx on public.presences (seance_id);

create table if not exists public.remarques_seance (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances (id) on delete cascade,
  texte text not null check (length(trim(texte)) > 0),
  created_at timestamptz not null default now()
);

comment on table public.remarques_seance is
  'Notes libres prises pendant ou après la séance : incidents, points à reprendre, observations sur un stagiaire.';

create index if not exists remarques_seance_idx
  on public.remarques_seance (seance_id, created_at desc);

alter table public.presences enable row level security;
alter table public.remarques_seance enable row level security;

-- Même règle de propriété que partout : le pivot du groupe, atteint par la
-- séance. On ne réécrit pas une cinquième variante.
create policy "presences_proprietaire" on public.presences
  for all to authenticated
  using (
    public.peut_acceder_groupe(
      (select s.groupe_id from public.seances s where s.id = seance_id)
    )
  )
  with check (
    public.peut_acceder_groupe(
      (select s.groupe_id from public.seances s where s.id = seance_id)
    )
  );

create policy "remarques_proprietaire" on public.remarques_seance
  for all to authenticated
  using (
    public.peut_acceder_groupe(
      (select s.groupe_id from public.seances s where s.id = seance_id)
    )
  )
  with check (
    public.peut_acceder_groupe(
      (select s.groupe_id from public.seances s where s.id = seance_id)
    )
  );
