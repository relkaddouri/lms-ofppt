-- 093_stagiaire_de_test.sql — compte de test du formateur (demande du 17/09/2026)
--
-- Un stagiaire « de test » par groupe : le formateur s'y connecte pour passer
-- un contrôle comme ses stagiaires le passeront, avant de le leur ouvrir.
--
-- Il n'est pas un stagiaire : il n'apparaît dans aucune liste, aucun appel,
-- aucun envoi, aucune statistique ni analyse — le code filtre « est_test ». Et
-- il voit ce que les stagiaires ne voient pas encore : les contrôles de son
-- groupe en brouillon, les tests non ouverts. Ses copies se suppriment pour
-- recommencer, et ne bloquent pas la modification d'un contrôle.
--
-- Son mot de passe, le formateur le choisit lui-même par le lien reçu dans sa
-- boîte : personne d'autre ne le voit jamais.

alter table public.stagiaires
  add column if not exists est_test boolean not null default false;

comment on column public.stagiaires.est_test is
  'Compte de test du formateur : invisible dans les listes et statistiques, voit les contrôles du groupe avant leur ouverture.';

-- Un seul par groupe : un second ne servirait qu'à brouiller les copies.
create unique index if not exists stagiaires_un_test_par_groupe
  on public.stagiaires (groupe_id) where est_test;

/** Vrai si l'utilisateur connecté est un compte de test. */
create or replace function public.je_suis_stagiaire_de_test()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stagiaires
     where user_id = auth.uid() and est_test
  );
$$;

revoke execute on function public.je_suis_stagiaire_de_test() from public, anon;
grant execute on function public.je_suis_stagiaire_de_test() to authenticated;

-- ── Lecture des contrôles ─────────────────────────────────────────────────
drop policy if exists "controles_lecture_stagiaire" on public.controles;
create policy "controles_lecture_stagiaire" on public.controles
  for select to authenticated
  using (
    groupe_id = public.groupe_du_stagiaire()
    and (
      public.je_suis_stagiaire_de_test()
      or (statut = 'valide' and (type <> 'TEST' or ouvert_le is not null))
    )
  );

-- ── Le sujet ──────────────────────────────────────────────────────────────
create or replace function public.get_sujet_pour_passation(p_controle_id uuid)
returns table (
  id uuid,
  type text,
  enonce text,
  donnees text,
  bareme numeric,
  options jsonb,
  "position" integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.type,
    q.enonce,
    q.donnees,
    q.bareme,
    -- Le drapeau « correcte » ne sort jamais, pas même pour le compte de test :
    -- il doit voir exactement ce que voient les stagiaires.
    case
      when q.type = 'qcm' and q.options is not null then (
        select jsonb_agg(jsonb_build_object('texte', o ->> 'texte') order by n)
        from jsonb_array_elements(q.options) with ordinality as t(o, n)
      )
      else null
    end as options,
    q."position"
  from public.questions_controle q
  join public.controles c on c.id = q.controle_id
  where c.id = p_controle_id
    and c.groupe_id = public.groupe_du_stagiaire()
    and (
      public.je_suis_stagiaire_de_test()
      or (c.statut = 'valide' and public.controle_ouvert(c))
    )
  order by q."position";
$$;

-- ── La remise ─────────────────────────────────────────────────────────────
create or replace function public.enregistrer_passation(p_controle_id uuid, p_details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_stagiaire public.stagiaires%rowtype;
  v_controle public.controles%rowtype;
  v_details jsonb;
  v_note numeric;
  v_total numeric;
  v_id uuid;
begin
  select * into v_stagiaire
  from public.stagiaires
  where user_id = auth.uid();

  if not found then
    raise exception 'Aucune fiche stagiaire pour ce compte'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_controle
  from public.controles
  where id = p_controle_id
    -- Le compte de test du formateur compose aussi un brouillon : c'est pour
    -- l'essayer avant les stagiaires qu'il existe (migration 093).
    and (statut = 'valide' or v_stagiaire.est_test)
    and groupe_id = v_stagiaire.groupe_id;

  if not found then
    raise exception 'Contrôle introuvable ou hors de votre groupe'
      using errcode = 'no_data_found';
  end if;

  -- Une copie par stagiaire et par contrôle : composer deux fois n'a pas de
  -- sens, et le jeton public le permettait.
  if exists (
    select 1 from public.passations_controle
    where controle_id = p_controle_id and stagiaire_id = v_stagiaire.id
  ) then
    raise exception 'Vous avez déjà rendu cette copie'
      using errcode = 'unique_violation';
  end if;

  -- La note est reconstruite à partir des questions RÉELLES : le client ne
  -- peut ni inventer une question, ni dépasser le barème.
  with saisie as (
    select
      (d ->> 'question_id')::uuid as question_id,
      coalesce((d ->> 'points')::numeric, 0) as points,
      coalesce(d ->> 'commentaire', '') as commentaire,
      coalesce(d ->> 'reponse', '') as reponse
    from jsonb_array_elements(coalesce(p_details, '[]'::jsonb)) as d
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
  where q.controle_id = p_controle_id;

  insert into public.passations_controle
    (controle_id, stagiaire_id, nom_complet, email, note, responses, submitted_at)
  values (
    p_controle_id,
    v_stagiaire.id,
    v_stagiaire.prenom || ' ' || v_stagiaire.nom,
    v_stagiaire.email,
    v_note,
    v_details,
    now()
  )
  returning id into v_id;

  return jsonb_build_object(
    'passationId', v_id,
    'note', v_note,
    'total', v_total,
    'details', v_details
  );
end;
$function$;
