-- 024 — Notation des QCM et propriétaire d'un contrôle public.
--
-- Depuis la migration 022, une question porte un type et des propositions. La
-- fonction de notation ne les exposait pas : un QCM était donc corrigé comme
-- une question ouverte, en comparant du texte libre à un corrigé absent.
--
-- Un QCM n'a pas besoin d'un modèle de langage pour être noté : la bonne
-- réponse est connue, la comparaison est exacte. Exposer `type` et `options`
-- permet à la route de trancher elle-même et de ne payer un appel que pour ce
-- qui demande réellement un jugement.

drop function if exists public.get_questions_with_corrige_for_scoring(uuid);

create or replace function public.get_questions_with_corrige_for_scoring(p_token uuid)
returns table (
  id uuid,
  controle_id uuid,
  type text,
  enonce text,
  bareme numeric,
  options jsonb,
  corrige text,
  "position" integer
)
language sql
security definer
set search_path = public
as $$
  select q.id, q.controle_id, q.type, q.enonce, q.bareme, q.options, q.corrige, q."position"
  from public.questions_controle q
  join public.controles c on c.id = q.controle_id
  where c.token_public = p_token
  order by q."position";
$$;

-- Réservée au serveur, comme avant : elle expose les corrigés.
revoke all on function public.get_questions_with_corrige_for_scoring(uuid)
  from public, anon, authenticated;
grant execute on function public.get_questions_with_corrige_for_scoring(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Le stagiaire n'a pas de compte : la route publique doit retrouver le
-- formateur propriétaire pour savoir quel modèle utiliser et quelle clé
-- déchiffrer. C'est la seule information exposée, et jamais au navigateur.
-- ---------------------------------------------------------------------------
create or replace function public.get_formateur_by_controle_token(p_token uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select coalesce(g.formateur_id, m.formateur_id)
  from public.controles c
  left join public.groupes g on g.id = c.groupe_id
  left join public.modules m on m.id = c.module_id
  where c.token_public = p_token
  limit 1;
$$;

revoke all on function public.get_formateur_by_controle_token(uuid)
  from public, anon, authenticated;
grant execute on function public.get_formateur_by_controle_token(uuid) to service_role;
