-- 100_classement_controle.sql — le classement d'une épreuve, annoncé au fil
--
-- Quand le formateur a fini de publier les copies d'un contrôle, il peut
-- annoncer le classement au groupe : les trois premiers sur un podium, puis
-- la classe rang par rang. C'est une annonce du fil comme une autre — on la
-- commente et on l'aime —, avec une carte qui lui est propre.
--
-- Le classement est **figé** au moment de l'annonce plutôt que recalculé à
-- chaque lecture. Une copie recorrigée ensuite ne doit pas réécrire en
-- silence un podium que tout le groupe a déjà lu ; le formateur réannonce
-- s'il veut le mettre à jour, et cela se voit.
--
-- Même motif que `distinctions_jour` : la table porte `annonce_id`, et c'est
-- ce lien qui fait la carte — pas le titre, qu'un formateur peut renommer.

create table if not exists public.classements_controle (
  annonce_id uuid primary key references public.annonces (id) on delete cascade,
  controle_id uuid not null references public.controles (id) on delete cascade,
  groupe_id uuid not null references public.groupes (id) on delete cascade,
  -- [{ rang, stagiaire_id, nom, prenom, photo, note, total }], déjà ordonné.
  lignes jsonb not null,
  moyenne numeric,
  total numeric not null,
  created_at timestamptz not null default now()
);

comment on table public.classements_controle is
  'Classement figé d''un contrôle, rattaché à l''annonce qui le porte. Recalculer à la lecture réécrirait un podium déjà lu.';

create index if not exists classements_controle_controle_idx
  on public.classements_controle (controle_id);

alter table public.classements_controle enable row level security;

-- Lecture : les stagiaires du groupe — c'est à eux que l'annonce s'adresse —
-- et le formateur du groupe.
drop policy if exists "classements_lecture" on public.classements_controle;
create policy "classements_lecture" on public.classements_controle
  for select to authenticated
  using (
    groupe_id = public.groupe_du_stagiaire()
    or exists (
      select 1 from public.groupes g
      where g.id = classements_controle.groupe_id
        and g.formateur_id = auth.uid()
    )
  );

-- Écriture : le formateur du groupe, et lui seul.
drop policy if exists "classements_formateur" on public.classements_controle;
create policy "classements_formateur" on public.classements_controle
  for all to authenticated
  using (
    exists (
      select 1 from public.groupes g
      where g.id = classements_controle.groupe_id
        and g.formateur_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.groupes g
      where g.id = classements_controle.groupe_id
        and g.formateur_id = auth.uid()
    )
  );
