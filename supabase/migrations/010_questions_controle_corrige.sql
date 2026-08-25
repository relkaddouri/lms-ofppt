-- Supprime le corrigé de la lecture publique des questions.
-- `create or replace` ne peut pas modifier le type de retour d'une fonction
-- existante (SQLSTATE 42P13) : il faut la supprimer d'abord. Les droits sont
-- réattribués en fin de fichier.
drop function if exists public.get_questions_by_controle_token(uuid);
create or replace function public.get_questions_by_controle_token(p_token uuid)
returns table (
  id uuid,
  controle_id uuid,
  enonce text,
  bareme numeric,
  "position" integer
)
language sql security definer
as $$
  select q.id, q.controle_id, q.enonce, q.bareme, q."position"
  from public.questions_controle q
  join public.controles c on c.id = q.controle_id
  where c.token_public = p_token
  order by q."position";
$$;

-- Fonction réservée à la notation côté serveur (ne jamais appeler depuis un composant client)
drop function if exists public.get_questions_with_corrige_for_scoring(uuid);
create or replace function public.get_questions_with_corrige_for_scoring(p_token uuid)
returns table (
  id uuid,
  controle_id uuid,
  enonce text,
  bareme numeric,
  corrige text,
  "position" integer
)
language sql security definer
as $$
  select q.id, q.controle_id, q.enonce, q.bareme, q.corrige, q."position"
  from public.questions_controle q
  join public.controles c on c.id = q.controle_id
  where c.token_public = p_token
  order by q."position";
$$;

revoke all on function public.get_questions_by_controle_token(uuid) from public;
revoke all on function public.get_questions_with_corrige_for_scoring(uuid) from public;
grant execute on function public.get_questions_by_controle_token(uuid) to anon;
grant execute on function public.get_questions_by_controle_token(uuid) to authenticated;
grant execute on function public.get_questions_with_corrige_for_scoring(uuid) to anon;
grant execute on function public.get_questions_with_corrige_for_scoring(uuid) to authenticated;
