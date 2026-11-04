-- 117_echeances_faites.sql — les échéances réglementaires se cochent
--
-- Demande du formateur (04/11/2026) : une échéance déjà accomplie (copies
-- rendues, résultats affichés…) restait en rouge « en retard de N jours ».
-- Il la coche désormais quand c'est fait ; elle quitte alors les retards.
--
-- Les échéances elles-mêmes ne sont pas stockées : elles se calculent à partir
-- de la date du contrôle (lib/echeances.ts). Seul le fait qu'elles soient
-- accomplies a besoin d'une trace, partagée entre les appareils du formateur.
-- Une ligne = une échéance cochée ; décocher supprime la ligne.

create table if not exists public.echeances_faites (
  controle_id uuid not null references public.controles (id) on delete cascade,
  type_echeance text not null check (
    type_echeance in (
      'preparation',
      'restitution_copies',
      'resultats',
      'restitution_notes'
    )
  ),
  fait_le timestamptz not null default now(),
  fait_par uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (controle_id, type_echeance)
);

comment on table public.echeances_faites is
  'Échéances réglementaires d''un contrôle cochées comme accomplies par le formateur. Les échéances se calculent, seul leur accomplissement est stocké.';

alter table public.echeances_faites enable row level security;

-- Le formateur du groupe du contrôle, et lui seul : lecture, cochage,
-- décochage. Pas de mise à jour : on coche ou on décoche.
drop policy if exists "echeances_faites_formateur" on public.echeances_faites;
create policy "echeances_faites_formateur" on public.echeances_faites
  for all to authenticated
  using (
    exists (
      select 1
      from public.controles c
      join public.groupes g on g.id = c.groupe_id
      where c.id = echeances_faites.controle_id
        and g.formateur_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.controles c
      join public.groupes g on g.id = c.groupe_id
      where c.id = echeances_faites.controle_id
        and g.formateur_id = auth.uid()
    )
  );
