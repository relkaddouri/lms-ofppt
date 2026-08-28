-- 041 — Passation par compte stagiaire.
--
-- Jusqu'ici une copie se composait par un lien public : le jeton ne
-- distinguait personne, n'importe qui pouvait composer plusieurs fois sous
-- n'importe quel nom. La passation s'appuie désormais sur le compte.
--
-- Deux fonctions, l'une pour lire le sujet, l'autre pour rendre la copie. Les
-- deux sont security definer : le stagiaire n'a aucun droit direct sur
-- questions_controle, précisément parce que cette table contient les corrigés.

create or replace function public.get_sujet_pour_passation(p_controle_id uuid)
returns table (
  id uuid,
  type text,
  enonce text,
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
    q.bareme,
    -- Le drapeau « correcte » ne sort jamais : c'est le corrigé du QCM.
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
    and c.statut = 'valide'
    and c.groupe_id = public.groupe_du_stagiaire()
  order by q."position";
$$;

comment on function public.get_sujet_pour_passation(uuid) is
  'Sujet remis au stagiaire : ni corrigé, ni bonne réponse de QCM. Réservé au groupe concerné.';

grant execute on function public.get_sujet_pour_passation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enregistrement de la copie.
-- ---------------------------------------------------------------------------
create or replace function public.enregistrer_passation(
  p_controle_id uuid,
  p_details jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    and statut = 'valide'
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
$$;

comment on function public.enregistrer_passation(uuid, jsonb) is
  'Enregistre la copie du stagiaire connecté. La note est recalculée sur les questions réelles ; une seule copie par contrôle.';

revoke all on function public.enregistrer_passation(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_passation(uuid, jsonb) to authenticated, service_role;
