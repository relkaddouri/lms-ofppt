-- Le formateur répond longuement, et en Markdown.
--
-- Deux mille caractères suffisent à une question de stagiaire, pas à la
-- réponse qu'elle appelle : un exemple de code, une démarche en cinq étapes,
-- un tableau qui compare deux méthodes. Le formateur coupait sa réponse, ou
-- renvoyait au cours prochain.
--
-- La limite se lève pour lui seul. La contrainte de table ne peut pas savoir
-- qui écrit — elle garde un plafond large, qui protège la base d'un collage
-- accidentel de plusieurs mégaoctets — et c'est `repondre_question`, qui le
-- sait, qui maintient les deux mille caractères pour un stagiaire. La
-- modération de la migration 085 a déjà fait passer toutes les écritures par
-- cette fonction.

alter table public.reponses_question
  drop constraint if exists reponses_question_texte_check;

alter table public.reponses_question
  add constraint reponses_question_texte_check
  check (length(trim(both from texte)) > 0 and length(texte) <= 20000);

comment on column public.reponses_question.texte is
  'Texte de la réponse. Markdown quand l''auteur est le formateur (20 000 caractères au plus), texte simple pour un stagiaire (2 000).';

create or replace function public.repondre_question(
  p_question_id uuid,
  p_texte text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question record;
  v_reglages record;
  v_statut text := 'publiee';
  v_id uuid;
begin
  if not public.peut_acceder_question(p_question_id) then
    raise exception 'Accès refusé à cette question.';
  end if;

  select groupe_id, statut, auteur_id into v_question
    from public.questions_support
   where id = p_question_id;

  if public.est_stagiaire() then
    -- Le plafond d'un stagiaire reste celui d'avant : c'est la réponse du
    -- formateur qui avait besoin de place, pas le fil entier.
    if length(p_texte) > 2000 then
      raise exception 'La réponse dépasse 2000 caractères.';
    end if;

    if v_question.statut <> 'publiee' and v_question.auteur_id <> auth.uid() then
      raise exception 'Accès refusé à cette question.';
    end if;

    select * into v_reglages
      from public.reglages_commentaires_groupe(v_question.groupe_id);
    if not coalesce(v_reglages.ouverts, true) then
      raise exception 'Les questions sont fermées sur les cours pour le moment.';
    end if;
    if coalesce(v_reglages.valides, true) then
      v_statut := 'en_attente';
    end if;
  end if;

  insert into public.reponses_question (question_id, auteur_id, texte, statut)
  values (p_question_id, auth.uid(), p_texte, v_statut)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.repondre_question(uuid, text) to authenticated;
