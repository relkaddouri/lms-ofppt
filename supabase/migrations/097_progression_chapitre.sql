-- 097_progression_chapitre.sql — le chapitre lu, marqué par le stagiaire (PRD §4.5bis)
--
-- Le parcours a besoin d'une trace : quels chapitres le stagiaire a lus, pour
-- afficher où il en est dans son module et lui proposer le suivant.
--
-- Elle lui appartient. Ce n'est ni une note ni un contrôle de présence : le
-- formateur ne la lit pas, ne la corrige pas, et aucune politique ne la lui
-- ouvre. Un stagiaire marque et démarque ses chapitres comme il veut.

create table if not exists public.progression_chapitre (
  stagiaire_id uuid not null references public.stagiaires (id) on delete cascade,
  support_id uuid not null references public.supports_seance (id) on delete cascade,
  lu_le timestamptz not null default now(),
  primary key (stagiaire_id, support_id)
);

comment on table public.progression_chapitre is
  'Chapitres qu''un stagiaire a marqués comme lus. Lui seul y accède : ce n''est pas un suivi du formateur.';

create index if not exists progression_chapitre_stagiaire_idx
  on public.progression_chapitre (stagiaire_id);

alter table public.progression_chapitre enable row level security;

drop policy if exists "progression_chapitre_mienne" on public.progression_chapitre;
create policy "progression_chapitre_mienne" on public.progression_chapitre
  for all to authenticated
  using (
    stagiaire_id in (
      select s.id from public.stagiaires s where s.user_id = auth.uid()
    )
  )
  with check (
    stagiaire_id in (
      select s.id from public.stagiaires s where s.user_id = auth.uid()
    )
  );
