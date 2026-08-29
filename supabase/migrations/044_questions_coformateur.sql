-- 044 — Un co-formateur voit aussi les questions de ses séances.
--
-- 043 rattachait la lecture au seul formateur principal du groupe
-- (groupes.formateur_id), alors qu'un groupe peut avoir plusieurs formateurs,
-- chacun sur un sous-ensemble de modules (PRD 4.1, migration 018). Le
-- formateur affecté au module ne voyait donc pas les questions posées sur ses
-- propres supports.
--
-- La condition d'archive reste : formateur_id est ce qui permet de retrouver
-- ses questions quand le groupe qui les a posées n'existe plus.

drop policy if exists "questions_support_lecture" on public.questions_support;
create policy "questions_support_lecture" on public.questions_support
  for select to authenticated
  using (
    formateur_id = auth.uid()
    or (groupe_id is not null and public.peut_acceder_groupe(groupe_id))
    or (groupe_id is not null and groupe_id = public.groupe_du_stagiaire())
  );

create or replace function public.peut_acceder_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.questions_support q
    where q.id = p_question_id
      and (
        q.formateur_id = auth.uid()
        or (q.groupe_id is not null and public.peut_acceder_groupe(q.groupe_id))
        or (q.groupe_id is not null and q.groupe_id = public.groupe_du_stagiaire())
      )
  );
$$;

-- La modération suit la même règle que la lecture côté formateur.
drop policy if exists "questions_support_suppression" on public.questions_support;
create policy "questions_support_suppression" on public.questions_support
  for delete to authenticated
  using (
    auteur_id = auth.uid()
    or formateur_id = auth.uid()
    or (groupe_id is not null and public.peut_acceder_groupe(groupe_id))
  );
