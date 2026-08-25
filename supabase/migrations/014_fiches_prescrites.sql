-- 014_fiches_prescrites.sql — Atome 1.2
--
-- Fiche prescrite d'une compétence : document officiel stable, saisi une fois
-- par compétence et réutilisé chaque année (PRD §3). À ne pas confondre avec la
-- fiche de préparation, qui est opérationnelle et rattachée à une séance.
--
-- Hiérarchie : compétence → fiche prescrite → éléments (A, B, C…) → critères
-- particuliers de performance.


create table if not exists public.fiches_prescrites (
  id uuid primary key default gen_random_uuid(),
  competence_id uuid not null unique
    references public.competences(id) on delete cascade,
  contexte_realisation text,
  criteres_generaux_performance text,
  created_at timestamptz not null default now()
);

comment on table public.fiches_prescrites is
  'Fiche prescrite officielle d une competence (une seule par competence).';
comment on column public.fiches_prescrites.contexte_realisation is
  'Conditions de realisation. Une ligne par element, separees par des sauts de ligne.';
comment on column public.fiches_prescrites.criteres_generaux_performance is
  'Criteres generaux, une ligne par critere.';


create table if not exists public.elements_competence (
  id uuid primary key default gen_random_uuid(),
  fiche_prescrite_id uuid not null
    references public.fiches_prescrites(id) on delete cascade,
  lettre text not null check (lettre ~ '^[A-Z]$'),
  intitule text not null,
  ordre integer not null check (ordre >= 1),
  created_at timestamptz not null default now(),
  unique (fiche_prescrite_id, lettre),
  unique (fiche_prescrite_id, ordre)
);

comment on table public.elements_competence is
  'Element de la competence (A, B, C...) au sein de sa fiche prescrite.';
comment on column public.elements_competence.lettre is
  'Le referentiel ne lettre pas toujours ses elements : la lettre est alors '
  'derivee de l ordre d apparition (1 -> A, 2 -> B...).';


create table if not exists public.criteres_particuliers_performance (
  id uuid primary key default gen_random_uuid(),
  element_competence_id uuid not null
    references public.elements_competence(id) on delete cascade,
  texte text not null,
  ordre integer not null check (ordre >= 1),
  created_at timestamptz not null default now(),
  unique (element_competence_id, ordre)
);

comment on table public.criteres_particuliers_performance is
  'Critere particulier de performance rattache a un element de competence.';


-- ============================================================================
-- RLS : lecture pour tout utilisateur authentifié, comme le reste du référentiel
-- ============================================================================

alter table public.fiches_prescrites enable row level security;
alter table public.elements_competence enable row level security;
alter table public.criteres_particuliers_performance enable row level security;

drop policy if exists "fiches_prescrites_select" on public.fiches_prescrites;
drop policy if exists "elements_competence_select" on public.elements_competence;
drop policy if exists "criteres_particuliers_select" on public.criteres_particuliers_performance;

create policy "fiches_prescrites_select" on public.fiches_prescrites
  for select to authenticated using (auth.uid() is not null);
create policy "elements_competence_select" on public.elements_competence
  for select to authenticated using (auth.uid() is not null);
create policy "criteres_particuliers_select" on public.criteres_particuliers_performance
  for select to authenticated using (auth.uid() is not null);
