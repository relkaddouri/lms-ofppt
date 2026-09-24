-- 099_quiz_bilan.sql — le quiz de bilan, toutes les trois séances (PRD §4.5bis)
--
-- Un quiz par chapitre vérifie qu'on a suivi ; un quiz de bilan vérifie qu'on
-- a retenu. Il arrive tous les trois chapitres, porte sur les trois à la fois,
-- et demande donc de les relier — ce qu'aucune question prise dans un seul
-- cours ne peut faire.
--
-- Même esprit que le quiz de chapitre : écrit une fois, conservé, non noté,
-- rejouable, jamais remonté au formateur. Le jalon est repéré par son rang
-- dans le module : 1 pour les chapitres 1 à 3, 2 pour les chapitres 4 à 6.

create table if not exists public.quiz_bilan (
  module_id uuid not null references public.modules (id) on delete cascade,
  groupe_id uuid not null references public.groupes (id) on delete cascade,
  rang integer not null check (rang >= 1),
  support_ids uuid[] not null,
  questions jsonb not null,
  modele text,
  genere_le timestamptz not null default now(),
  primary key (module_id, groupe_id, rang)
);

comment on table public.quiz_bilan is
  'Quiz de bilan d''un module, un par groupe de trois chapitres. Non noté, rejouable ; le groupe entre dans la clé car deux groupes n''ont pas les mêmes supports.';

alter table public.quiz_bilan enable row level security;

-- Lecture : les stagiaires du groupe concerné, et le formateur du module.
drop policy if exists "quiz_bilan_lecture" on public.quiz_bilan;
create policy "quiz_bilan_lecture" on public.quiz_bilan
  for select to authenticated
  using (
    public.peut_acceder_module(module_id)
    or groupe_id = public.groupe_du_stagiaire()
  );

-- Écriture : le formateur du module. La génération passe par la route, qui
-- écrit avec la clé de service après avoir vérifié l'accès aux chapitres.
drop policy if exists "quiz_bilan_formateur" on public.quiz_bilan;
create policy "quiz_bilan_formateur" on public.quiz_bilan
  for all to authenticated
  using (public.peut_acceder_module(module_id))
  with check (public.peut_acceder_module(module_id));
