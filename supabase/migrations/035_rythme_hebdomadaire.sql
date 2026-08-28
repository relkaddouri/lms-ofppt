-- 035 — Rythme hebdomadaire cible du formateur.
--
-- Le PRD §4.10 est explicite : l'administration démarre l'année autour de
-- 27,5 h par semaine et réduit progressivement jusqu'à 25 h. Le suivi doit donc
-- comparer chaque semaine à SA cible, pas à une moyenne annuelle constante —
-- sinon une semaine de 26 h passerait pour normale en juin et pour excédentaire
-- en septembre, alors que c'est l'inverse.
--
-- Une période sans cible retombe sur la moyenne légale, 910 h sur 35 semaines.

create table if not exists public.rythmes_hebdomadaires (
  id uuid primary key default gen_random_uuid(),
  formateur_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  heures_cible numeric(4, 1) not null check (heures_cible > 0 and heures_cible <= 40),
  created_at timestamptz not null default now(),
  constraint periode_coherente check (date_debut <= date_fin)
);

comment on table public.rythmes_hebdomadaires is
  'Rythme hebdomadaire cible par période. Au-delà de la cible de la semaine, les heures sont supplémentaires.';

create index if not exists rythmes_formateur_idx
  on public.rythmes_hebdomadaires (formateur_id, date_debut);

alter table public.rythmes_hebdomadaires enable row level security;

create policy "rythmes_proprietaire" on public.rythmes_hebdomadaires
  for all to authenticated
  using (formateur_id = auth.uid())
  with check (formateur_id = auth.uid());
