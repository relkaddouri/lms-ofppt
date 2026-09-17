-- 094_correction_publiee.sql — la copie corrigée, vue par son auteur
--
-- Une fois son résultat publié, le stagiaire revient sur le contrôle et
-- compare, question par question, sa réponse à la bonne : pour un QCM, les
-- propositions justes ; pour une question ouverte ou un exercice, la réponse
-- attendue ; et le commentaire du formateur.
--
-- Les propositions justes ne sortent jamais autrement (le sujet les retire,
-- migration 025). Cette fonction ne les rend qu'au stagiaire dont la copie
-- sur ce contrôle est publiée : avant la publication, rien ; à un camarade
-- qui n'a pas de copie publiée, rien.

create or replace function public.get_ma_correction(p_controle_id uuid)
returns table (
  question_id uuid,
  "position" integer,
  type text,
  enonce text,
  donnees text,
  bareme numeric,
  options jsonb,
  corrige text
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q."position", q.type, q.enonce, q.donnees, q.bareme, q.options, q.corrige
  from public.questions_controle q
  where q.controle_id = p_controle_id
    and exists (
      select 1
        from public.passations_controle p
        join public.stagiaires s on s.id = p.stagiaire_id
       where p.controle_id = p_controle_id
         and s.user_id = auth.uid()
         and p.publie_le is not null
    )
  order by q."position";
$$;

revoke execute on function public.get_ma_correction(uuid) from public, anon;
grant execute on function public.get_ma_correction(uuid) to authenticated;
