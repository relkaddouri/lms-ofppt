-- 102_lecture_suivi.sql — ce que le suivi d'un stagiaire veut dire
-- (demande du 25 septembre 2026, atome 13.3)
--
-- La fiche de suivi donne des chiffres ; elle ne dit pas ce qu'ils valent.
-- Le formateur peut demander au modèle une lecture : ce que ce stagiaire
-- maîtrise, ce qui lui manque, quoi reprendre avec lui.
--
-- Écrite une fois puis conservée : une lecture recalculée à chaque ouverture
-- coûterait un appel de modèle par coup d'œil, et changerait de mots sans
-- que rien n'ait changé dans le travail du stagiaire. Le formateur la
-- relance quand il veut.
--
-- Elle ne quitte jamais son écran : aucune politique ne l'ouvre au stagiaire,
-- et le modèle, lui, ne reçoit ni nom ni prénom.

create table if not exists public.lectures_suivi (
  stagiaire_id uuid primary key references public.stagiaires (id) on delete cascade,
  -- { resume, forces[], lacunes[], conseils[] }
  contenu jsonb not null,
  -- Ce sur quoi la lecture a été faite : « 12 tentatives · 4 chapitres lus ».
  assise text,
  modele text,
  genere_le timestamptz not null default now()
);

comment on table public.lectures_suivi is
  'Lecture par le modèle du suivi d''un stagiaire. Écrite à la demande du formateur, jamais montrée au stagiaire.';

alter table public.lectures_suivi enable row level security;

-- Lecture et écriture : le formateur du groupe du stagiaire, lui seul.
drop policy if exists "lectures_suivi_formateur" on public.lectures_suivi;
create policy "lectures_suivi_formateur" on public.lectures_suivi
  for all to authenticated
  using (
    exists (
      select 1
      from public.stagiaires s
      join public.groupes g on g.id = s.groupe_id
      where s.id = lectures_suivi.stagiaire_id
        and g.formateur_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.stagiaires s
      join public.groupes g on g.id = s.groupe_id
      where s.id = lectures_suivi.stagiaire_id
        and g.formateur_id = auth.uid()
    )
  );
