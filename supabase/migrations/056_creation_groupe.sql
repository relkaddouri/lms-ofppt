-- Impossible de créer un groupe : « new row violates row-level security
-- policy for table groupes ».
--
-- Ce n'était pas l'écriture qui échouait — `WITH CHECK (formateur_id =
-- auth.uid())` passait — mais la relecture de la ligne. Le client demande
-- `INSERT … RETURNING`, et Postgres exige alors que la nouvelle ligne
-- satisfasse aussi la politique de lecture.
--
-- Or `groupes_select` passe par `peut_acceder_groupe(id)`, une fonction
-- `security definer` qui va relire `groupes` : dans le même `INSERT`, cette
-- sous-requête travaille sur l'instantané d'avant l'insertion et ne voit
-- donc pas la ligne qu'on vient d'écrire. La fonction répondait « non » sur
-- un groupe qui existait pourtant, et l'insertion était rejetée.
--
-- La politique de lecture teste désormais la colonne directement avant de
-- déléguer : le propriétaire se reconnaît sans relire la table, et le cas du
-- co-formateur continue de passer par la fonction.

drop policy if exists "groupes_select" on public.groupes;
create policy "groupes_select" on public.groupes
  for select to authenticated
  using (formateur_id = auth.uid() or peut_acceder_groupe(id));

drop policy if exists "groupes_write" on public.groupes;
create policy "groupes_write" on public.groupes
  for all to authenticated
  using (formateur_id = auth.uid() or peut_acceder_groupe(id))
  with check (formateur_id = auth.uid());

drop function if exists public._sonde_uid();
