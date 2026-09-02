-- Générer le plan de déroulement échouait sur « new row violates row-level
-- security policy for table seances ».
--
-- Même piège que pour les groupes : l'écriture passait, c'est la relecture
-- qui échouait. Une séance appartient à un groupe *par la table de liaison*
-- (migration 052), et cette liaison ne peut être posée qu'après l'insertion.
-- Entre les deux, la séance n'est rattachée à rien, donc invisible pour la
-- politique de lecture — et le `RETURNING` du client la refusait.
--
-- Plutôt que d'ouvrir la lecture à toute séance sans groupe, ce qui exposerait
-- les orphelines à n'importe quel formateur, la séance retient qui l'a créée.
-- Son auteur peut la relire tant qu'elle n'est rattachée à aucun groupe ;
-- dès qu'elle l'est, la règle habituelle reprend la main.

alter table public.seances
  add column if not exists cree_par uuid default auth.uid();

comment on column public.seances.cree_par is
  'Auteur de la ligne. Sert uniquement à la relire pendant l''instant où '
  'elle n''est encore rattachée à aucun groupe.';

drop policy if exists "seances_select" on public.seances;
create policy "seances_select" on public.seances
  for select to authenticated
  using (
    exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = seances.id and peut_acceder_groupe(sg.groupe_id)
    )
    or (
      cree_par = auth.uid()
      and not exists (
        select 1 from public.seance_groupes sg where sg.seance_id = seances.id
      )
    )
  );

drop policy if exists "seances_write" on public.seances;
create policy "seances_write" on public.seances
  for all to authenticated
  using (
    exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = seances.id and peut_acceder_groupe(sg.groupe_id)
    )
    or (
      cree_par = auth.uid()
      and not exists (
        select 1 from public.seance_groupes sg where sg.seance_id = seances.id
      )
    )
  )
  with check (
    cree_par = auth.uid()
    or exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = seances.id and peut_acceder_groupe(sg.groupe_id)
    )
  );
