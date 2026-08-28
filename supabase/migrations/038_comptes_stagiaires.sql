-- 038 — Comptes stagiaires.
--
-- Jusqu'ici un stagiaire était une ligne sans identité : il accédait à son
-- groupe et à ses contrôles par un lien public porteur d'un jeton. Ce jeton ne
-- distingue personne — quiconque l'obtient voit tout, et le stagiaire lui-même
-- ne peut rien consulter qui lui soit propre.
--
-- Il devient un compte : une ligne auth.users, un rôle, et des policies qui le
-- limitent à SON groupe.

alter table public.profils
  drop constraint if exists profils_role_check;
alter table public.profils
  add constraint profils_role_check
  check (role in ('formateur', 'admin', 'stagiaire'));

alter table public.stagiaires
  add column if not exists user_id uuid unique references auth.users (id) on delete set null;

comment on column public.stagiaires.user_id is
  'Compte du stagiaire. Nul tant qu''il n''a pas été invité : la fiche existe avant le compte.';

create index if not exists stagiaires_user_idx on public.stagiaires (user_id);

-- ---------------------------------------------------------------------------
-- Pivot de lecture côté stagiaire, symétrique de peut_acceder_groupe côté
-- formateur. Une seule fonction, réutilisée par toutes les policies.
-- ---------------------------------------------------------------------------
create or replace function public.groupe_du_stagiaire()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.groupe_id from public.stagiaires s where s.user_id = auth.uid();
$$;

comment on function public.groupe_du_stagiaire() is
  'Groupe du stagiaire connecté, ou NULL s''il n''en est pas un. Point unique de contrôle pour les lectures côté stagiaire.';

grant execute on function public.groupe_du_stagiaire() to authenticated;

-- ---------------------------------------------------------------------------
-- Lectures ouvertes au stagiaire, strictement limitées à son groupe.
-- Les policies existantes du formateur ne sont pas touchées : elles coexistent,
-- et une policy permissive suffit à autoriser.
-- ---------------------------------------------------------------------------
drop policy if exists "groupes_lecture_stagiaire" on public.groupes;
create policy "groupes_lecture_stagiaire" on public.groupes
  for select to authenticated
  using (id = public.groupe_du_stagiaire());

drop policy if exists "stagiaires_lecture_camarades" on public.stagiaires;
create policy "stagiaires_lecture_camarades" on public.stagiaires
  for select to authenticated
  using (groupe_id = public.groupe_du_stagiaire());

drop policy if exists "seances_lecture_stagiaire" on public.seances;
create policy "seances_lecture_stagiaire" on public.seances
  for select to authenticated
  using (groupe_id = public.groupe_du_stagiaire());

drop policy if exists "annonces_lecture_stagiaire" on public.annonces;
create policy "annonces_lecture_stagiaire" on public.annonces
  for select to authenticated
  using (groupe_id = public.groupe_du_stagiaire());

drop policy if exists "modules_lecture_stagiaire" on public.modules;
create policy "modules_lecture_stagiaire" on public.modules
  for select to authenticated
  using (
    exists (
      select 1 from public.groupe_modules gm
      where gm.module_id = modules.id
        and gm.groupe_id = public.groupe_du_stagiaire()
    )
  );

drop policy if exists "groupe_modules_lecture_stagiaire" on public.groupe_modules;
create policy "groupe_modules_lecture_stagiaire" on public.groupe_modules
  for select to authenticated
  using (groupe_id = public.groupe_du_stagiaire());

-- Un contrôle n'est visible qu'une fois validé : un brouillon est un document
-- de travail du formateur.
drop policy if exists "controles_lecture_stagiaire" on public.controles;
create policy "controles_lecture_stagiaire" on public.controles
  for select to authenticated
  using (groupe_id = public.groupe_du_stagiaire() and statut = 'valide');

-- Le support de cours est fait pour être remis ; la fiche de préparation est
-- l'outil du formateur et reste hors de portée.
drop policy if exists "supports_lecture_stagiaire" on public.supports_seance;
create policy "supports_lecture_stagiaire" on public.supports_seance
  for select to authenticated
  using (
    exists (
      select 1 from public.seances s
      where s.id = supports_seance.seance_id
        and s.groupe_id = public.groupe_du_stagiaire()
    )
  );

-- Une copie était identifiée par le nom saisi au clavier : deux homonymes se
-- confondaient, et une faute de frappe créait un inconnu. Elle se rattache
-- désormais au compte. La colonne reste nulle pour les copies antérieures, que
-- rien ne permet de rattacher rétroactivement de façon sûre.
alter table public.passations_controle
  add column if not exists stagiaire_id uuid references public.stagiaires (id) on delete set null;

create index if not exists passations_stagiaire_idx
  on public.passations_controle (stagiaire_id);

-- Chacun ne voit que sa propre copie, jamais celle d'un camarade.
drop policy if exists "passations_lecture_stagiaire" on public.passations_controle;
create policy "passations_lecture_stagiaire" on public.passations_controle
  for select to authenticated
  using (
    stagiaire_id in (
      select s.id from public.stagiaires s where s.user_id = auth.uid()
    )
  );
