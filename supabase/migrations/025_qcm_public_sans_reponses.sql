-- 025 — Propositions de QCM côté stagiaire, sans les bonnes réponses.
--
-- `questions_controle.options` contient, pour chaque proposition, un drapeau
-- `correcte`. La passation doit afficher les propositions — sinon un QCM est
-- inrépondable — mais renvoyer l'objet tel quel livrerait le corrigé au
-- stagiaire, dans la charge de la page. C'est exactement la fuite déjà
-- corrigée sur `corrige` ; on ne la réintroduit pas par une autre porte.
--
-- La fonction reconstruit donc chaque proposition en ne gardant que son texte.

drop function if exists public.get_questions_by_controle_token(uuid);

create or replace function public.get_questions_by_controle_token(p_token uuid)
returns table (
  id uuid,
  controle_id uuid,
  type text,
  enonce text,
  bareme numeric,
  options jsonb,
  "position" integer
)
language sql
security definer
set search_path = public
as $$
  select
    q.id,
    q.controle_id,
    q.type,
    q.enonce,
    q.bareme,
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
  where c.token_public = p_token
  order by q."position";
$$;

grant execute on function public.get_questions_by_controle_token(uuid) to anon, authenticated, service_role;
