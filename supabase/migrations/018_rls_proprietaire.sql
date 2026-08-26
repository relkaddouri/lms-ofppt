-- 018_rls_proprietaire.sql — Atome 1.9
--
-- Durcissement réel de la RLS. Depuis la migration 011, les trois fonctions
-- pivot renvoyaient « tout utilisateur authentifié » : structure en place,
-- cloisonnement inexistant. `formateur_id` existe désormais sur
-- groupe_modules (migration 017), on peut brancher pour de bon.
--
-- Pourquoi une colonne de propriété directe en plus de groupe_modules :
--   * un groupe sans module assigné deviendrait invisible à tout le monde ;
--   * à la création d'un groupe, aucune assignation n'existe encore, donc le
--     WITH CHECK échouerait et la création serait impossible.
-- D'où groupes.formateur_id et modules.formateur_id, avec `default auth.uid()`.
--
-- ATTENTION : `auth.uid()` vaut NULL quand l'insertion vient du rôle service
-- (scripts de seed, routes serveur). Ces chemins doivent renseigner
-- formateur_id explicitement, sinon la ligne créée n'est visible de personne.


-- ============================================================================
-- 1. Propriété directe
-- ============================================================================

alter table public.groupes
  add column if not exists formateur_id uuid default auth.uid()
  references public.profils(id) on delete set null;

alter table public.modules
  add column if not exists formateur_id uuid default auth.uid()
  references public.profils(id) on delete set null;

create index if not exists groupes_formateur_id_idx on public.groupes (formateur_id);
create index if not exists modules_formateur_id_idx on public.modules (formateur_id);

comment on column public.groupes.formateur_id is
  'Formateur responsable du groupe. Complete groupe_modules.formateur_id : un '
  'groupe reste accessible a son responsable meme sans module assigne.';
comment on column public.modules.formateur_id is
  'Formateur proprietaire du module.';

-- Reprise des lignes existantes : elles ont ete creees avant la colonne.
-- On ne le fait que s il n existe qu un seul profil, sinon l attribution
-- serait arbitraire et il vaut mieux laisser la reprise a un humain.
do $$
declare
  v_profil uuid;
begin
  select id into v_profil from public.profils limit 1;
  if v_profil is not null and (select count(*) from public.profils) = 1 then
    update public.groupes set formateur_id = v_profil where formateur_id is null;
    update public.modules set formateur_id = v_profil where formateur_id is null;
    update public.groupe_modules set formateur_id = v_profil where formateur_id is null;
  else
    raise notice 'Reprise de formateur_id ignoree : 0 ou plusieurs profils.';
  end if;
end;
$$;


-- ============================================================================
-- 2. Les trois pivots, branchés sur le propriétaire réel
-- ============================================================================
-- `security definer` : ces fonctions lisent groupes / modules / groupe_modules
-- sans repasser par la RLS, ce qui evite une recursion infinie de policy.

create or replace function public.peut_acceder_groupe(p_groupe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groupes g
    where g.id = p_groupe_id and g.formateur_id = auth.uid()
  ) or exists (
    -- Un groupe peut avoir plusieurs formateurs, chacun sur un sous-ensemble
    -- de modules (PRD 4.1) : etre assigne a un seul suffit pour y acceder.
    select 1 from public.groupe_modules gm
    where gm.groupe_id = p_groupe_id and gm.formateur_id = auth.uid()
  );
$$;

create or replace function public.peut_acceder_module(p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.modules m
    where m.id = p_module_id and m.formateur_id = auth.uid()
  ) or exists (
    select 1 from public.groupe_modules gm
    where gm.module_id = p_module_id and gm.formateur_id = auth.uid()
  );
$$;

create or replace function public.peut_acceder_controle(p_controle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.controles c
    where c.id = p_controle_id and public.peut_acceder_module(c.module_id)
  );
$$;


-- ============================================================================
-- 3. Policies dont le WITH CHECK ne peut pas passer par un pivot
-- ============================================================================
-- A l INSERT, la ligne n existe pas encore : un pivot qui la cherche par son id
-- renverrait faux et bloquerait toute creation. Le controle porte donc
-- directement sur la colonne de propriete de la ligne inseree.

drop policy if exists "groupes_write" on public.groupes;
create policy "groupes_write" on public.groupes
  for all to authenticated
  using (public.peut_acceder_groupe(id))
  with check (formateur_id = auth.uid());

drop policy if exists "modules_write" on public.modules;
create policy "modules_write" on public.modules
  for all to authenticated
  using (public.peut_acceder_module(id))
  with check (formateur_id = auth.uid());


-- ============================================================================
-- 4. audit_log : tracable par son auteur autant que par le module
-- ============================================================================
-- Les lignes d une suppression referencent un controle qui n existe plus :
-- sans la clause sur `utilisateur`, elles deviendraient invisibles a tous.

drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log
  for select to authenticated
  using (utilisateur = auth.uid() or public.peut_acceder_controle(ligne_id));
