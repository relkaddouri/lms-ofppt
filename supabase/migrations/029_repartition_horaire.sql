-- 029 — Répartition de la masse horaire sur les objectifs d'apprentissage.
--
-- C'est la case que le manuel de formateur laisse en « ? ». L'OFPPT annonce
-- une durée nationale (120 h pour la compétence 6) et une part théorique /
-- pratique / évaluation, mais la masse horaire réellement allouée dépend du
-- groupe : 115 h sur DES101, 85 h sur DES102 pour le même module. Répartir
-- cette masse sur les objectifs est le travail que l'application reprend.

create table if not exists public.repartition_horaire (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.groupes (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  suggestion_pedagogique_id uuid not null
    references public.suggestions_pedagogiques (id) on delete cascade,
  heures_theoriques numeric(5, 2) not null default 0 check (heures_theoriques >= 0),
  heures_pratiques numeric(5, 2) not null default 0 check (heures_pratiques >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un objectif n'est réparti qu'une fois par couple groupe + module.
  unique (groupe_id, module_id, suggestion_pedagogique_id)
);

comment on table public.repartition_horaire is
  'Heures allouées à chaque objectif d''apprentissage pour un couple groupe + module. Remplit le « ? H » du plan de déroulement officiel.';

create index if not exists repartition_horaire_couple_idx
  on public.repartition_horaire (groupe_id, module_id);

alter table public.repartition_horaire enable row level security;

-- Même règle de propriété que partout ailleurs : le pivot du groupe.
create policy "repartition_proprietaire" on public.repartition_horaire
  for all to authenticated
  using (public.peut_acceder_groupe(groupe_id))
  with check (public.peut_acceder_groupe(groupe_id));

-- Les pourcentages relevés dans les manuels de formateur fournis. Ils sont
-- identiques sur les compétences observées ; ils restent modifiables par
-- compétence plutôt que codés en dur dans l'application.
update public.competences
set pct_theorique = 60, pct_pratique = 34, pct_evaluation = 6
where pct_theorique is null;
