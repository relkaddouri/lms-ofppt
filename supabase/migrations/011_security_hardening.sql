-- 011_security_hardening.sql — Atome 0.1
--
-- Objectifs :
--   1. Retirer l'insertion anonyme de passations et la remplacer par une fonction
--      `security definer` qui recalcule la note en base et insère elle-même la ligne.
--   2. Rendre le corrigé inaccessible au rôle anon (réservé à la route serveur / service_role).
--   3. Supprimer la policy d'insertion sur audit_log (le trigger security definer suffit).
--   4. Remplacer les policies `using (true) with check (true)` par des policies qui passent
--      toutes par des fonctions pivot, seul endroit à durcir quand `formateur_id` arrivera (1.6).
--
-- Aucune restriction fonctionnelle n'est introduite dès aujourd'hui : les fonctions pivot
-- renvoient « utilisateur authentifié », strictement équivalent au comportement actuel.
--
-- NOTE : la base a divergé des fichiers de migration (des policies ont été modifiées hors
-- migration). Ce fichier ne droppe donc pas les policies par leur nom supposé : il balaie
-- TOUTES les policies existantes des tables métier (§0) avant de recréer le jeu canonique.
-- Il est ainsi idempotent et rejouable quel que soit l'état de départ.


-- ============================================================================
-- 0. Balayage : on repart d'un état déterministe
-- ============================================================================
-- `profils` est volontairement exclu : ses policies sont déjà restreintes au
-- propriétaire (auth.uid() = id) et ne font pas partie des tables métier.

do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'modules', 'groupes', 'groupe_modules', 'stagiaires', 'seances',
        'fiches_preparation', 'annonces', 'controles', 'questions_controle',
        'passations_controle', 'audit_log'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;


-- ============================================================================
-- 1. Fonctions pivot d'accès
-- ============================================================================
-- Point de bascule unique. En phase 1.6, une fois `groupe_modules.formateur_id`
-- créé, seul le CORPS de ces trois fonctions change — aucune policy n'est retouchée.

create or replace function public.peut_acceder_groupe(p_groupe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Phase 1.6 : and exists (select 1 from public.groupe_modules gm
  --                         where gm.groupe_id = p_groupe_id and gm.formateur_id = auth.uid())
  select auth.uid() is not null;
$$;

create or replace function public.peut_acceder_module(p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Phase 1.6 : and exists (select 1 from public.groupe_modules gm
  --                         where gm.module_id = p_module_id and gm.formateur_id = auth.uid())
  select auth.uid() is not null;
$$;

create or replace function public.peut_acceder_controle(p_controle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Phase 1.6 : dérivé du module du contrôle. Doit rester permissif quand le contrôle
  -- n'existe plus (lignes d'audit d'une suppression), sinon l'historique perd ses DELETE.
  select auth.uid() is not null;
$$;

comment on function public.peut_acceder_groupe(uuid) is
  'Pivot RLS groupe. Corps à durcir en phase 1.6 (formateur_id = auth.uid()).';
comment on function public.peut_acceder_module(uuid) is
  'Pivot RLS module. Corps à durcir en phase 1.6 (formateur_id = auth.uid()).';
comment on function public.peut_acceder_controle(uuid) is
  'Pivot RLS contrôle. Corps à durcir en phase 1.6 (dérivé du module).';


-- ============================================================================
-- 2. Soumission de passation : plus aucune écriture directe depuis le client
-- ============================================================================


create policy "passations_select" on public.passations_controle
  for select to authenticated
  using (public.peut_acceder_controle(controle_id));

-- Plus aucune policy INSERT : la seule voie d'écriture est submit_passation ci-dessous,
-- qui insère en `security definer` et contourne donc la RLS de façon contrôlée.

create or replace function public.submit_passation(p_token uuid, p_responses jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_controle public.controles%rowtype;
  v_nom text;
  v_email text;
  v_details jsonb;
  v_note numeric;
  v_total numeric;
  v_passation_id uuid;
begin
  select * into v_controle
  from public.controles
  where token_public = p_token;

  if not found then
    raise exception 'Contrôle introuvable' using errcode = 'no_data_found';
  end if;

  v_nom := nullif(btrim(coalesce(p_responses ->> 'nom', '')), '');
  if v_nom is null then
    raise exception 'Nom du stagiaire requis' using errcode = 'check_violation';
  end if;
  v_email := nullif(btrim(coalesce(p_responses ->> 'email', '')), '');

  -- La note est reconstruite à partir des questions RÉELLES du contrôle, pas de ce que
  -- le client a envoyé : il ne peut ni inventer une question, ni dépasser le barème.
  with saisie as (
    select
      (d ->> 'question_id')::uuid as question_id,
      coalesce((d ->> 'points')::numeric, 0) as points,
      coalesce(d ->> 'commentaire', '') as commentaire,
      coalesce(d ->> 'reponse', '') as reponse
    from jsonb_array_elements(coalesce(p_responses -> 'details', '[]'::jsonb)) as d
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'question_id', q.id,
          'enonce', q.enonce,
          'bareme', q.bareme,
          'points', least(greatest(coalesce(s.points, 0), 0), q.bareme),
          'commentaire', coalesce(s.commentaire, ''),
          'corrige', q.corrige,
          'reponse', coalesce(s.reponse, '')
        )
        order by q."position"
      ),
      '[]'::jsonb
    ),
    coalesce(sum(least(greatest(coalesce(s.points, 0), 0), q.bareme)), 0),
    coalesce(sum(q.bareme), 0)
  into v_details, v_note, v_total
  from public.questions_controle q
  left join saisie s on s.question_id = q.id
  where q.controle_id = v_controle.id;

  v_note := round(v_note, 1);

  insert into public.passations_controle
    (controle_id, nom_complet, email, note, responses, submitted_at)
  values
    (v_controle.id, v_nom, v_email, v_note, v_details, now())
  returning id into v_passation_id;

  return jsonb_build_object(
    'passationId', v_passation_id,
    'titre', v_controle.titre,
    'note', v_note,
    'total', v_total,
    'details', v_details
  );
end;
$$;

-- Appelable uniquement par la route serveur (service_role) : un client anon qui
-- l'appellerait pourrait sinon se soumettre le barème plein sur chaque question.
revoke all on function public.submit_passation(uuid, jsonb) from public;
revoke all on function public.submit_passation(uuid, jsonb) from anon;
revoke all on function public.submit_passation(uuid, jsonb) from authenticated;
grant execute on function public.submit_passation(uuid, jsonb) to service_role;


-- ============================================================================
-- 3. Corrigé : retiré du rôle anon
-- ============================================================================

revoke all on function public.get_questions_with_corrige_for_scoring(uuid) from public;
revoke all on function public.get_questions_with_corrige_for_scoring(uuid) from anon;
revoke all on function public.get_questions_with_corrige_for_scoring(uuid) from authenticated;
grant execute on function public.get_questions_with_corrige_for_scoring(uuid) to service_role;


-- ============================================================================
-- 4. audit_log : plus d'insertion applicative
-- ============================================================================


create policy "audit_log_select" on public.audit_log
  for select to authenticated
  using (public.peut_acceder_controle(ligne_id));


-- ============================================================================
-- 5. Tables métier : sortie des policies `using (true) with check (true)`
-- ============================================================================

-- modules
create policy "modules_select" on public.modules
  for select to authenticated using (public.peut_acceder_module(id));
create policy "modules_write" on public.modules
  for all to authenticated
  using (public.peut_acceder_module(id))
  with check (public.peut_acceder_module(id));

-- groupes
create policy "groupes_select" on public.groupes
  for select to authenticated using (public.peut_acceder_groupe(id));
create policy "groupes_write" on public.groupes
  for all to authenticated
  using (public.peut_acceder_groupe(id))
  with check (public.peut_acceder_groupe(id));

-- groupe_modules
create policy "groupe_modules_select" on public.groupe_modules
  for select to authenticated using (public.peut_acceder_groupe(groupe_id));
create policy "groupe_modules_write" on public.groupe_modules
  for all to authenticated
  using (public.peut_acceder_groupe(groupe_id))
  with check (public.peut_acceder_groupe(groupe_id));

-- stagiaires
create policy "stagiaires_select" on public.stagiaires
  for select to authenticated using (public.peut_acceder_groupe(groupe_id));
create policy "stagiaires_write" on public.stagiaires
  for all to authenticated
  using (public.peut_acceder_groupe(groupe_id))
  with check (public.peut_acceder_groupe(groupe_id));

-- seances
create policy "seances_select" on public.seances
  for select to authenticated using (public.peut_acceder_groupe(groupe_id));
create policy "seances_write" on public.seances
  for all to authenticated
  using (public.peut_acceder_groupe(groupe_id))
  with check (public.peut_acceder_groupe(groupe_id));

-- annonces
create policy "annonces_select" on public.annonces
  for select to authenticated using (public.peut_acceder_groupe(groupe_id));
create policy "annonces_write" on public.annonces
  for all to authenticated
  using (public.peut_acceder_groupe(groupe_id))
  with check (public.peut_acceder_groupe(groupe_id));

-- fiches_preparation
create policy "fiches_preparation_select" on public.fiches_preparation
  for select to authenticated using (public.peut_acceder_module(module_id));
create policy "fiches_preparation_write" on public.fiches_preparation
  for all to authenticated
  using (public.peut_acceder_module(module_id))
  with check (public.peut_acceder_module(module_id));

-- controles
create policy "controles_select" on public.controles
  for select to authenticated using (public.peut_acceder_module(module_id));
create policy "controles_write" on public.controles
  for all to authenticated
  using (public.peut_acceder_module(module_id))
  with check (public.peut_acceder_module(module_id));

-- questions_controle
create policy "questions_controle_select" on public.questions_controle
  for select to authenticated using (public.peut_acceder_controle(controle_id));
create policy "questions_controle_write" on public.questions_controle
  for all to authenticated
  using (public.peut_acceder_controle(controle_id))
  with check (public.peut_acceder_controle(controle_id));
