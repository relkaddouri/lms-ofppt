-- Réparation : poser une question sur un cours était devenu impossible.
--
-- `poser_question_support` lisait `seances.groupe_id`. La migration 052 a
-- supprimé cette colonne en passant aux séances partagées — une séance
-- appartient depuis à plusieurs groupes, par `seance_groupes` — et la fonction
-- n'a pas suivi. Elle échouait donc sur « column s.groupe_id does not exist »,
-- à chaque tentative, depuis ce jour : aucun stagiaire n'a jamais pu
-- commenter un cours, et le formateur n'a jamais rien reçu à répondre.
--
-- C'est exactement le trou que les points de vigilance du backlog décrivent :
-- un changement de schéma se vérifie en relisant ce qui lit la colonne, pas en
-- lançant le compilateur — une fonction SQL lui est invisible.
--
-- La réparation ne se contente pas de traduire la colonne. Deux choses ont
-- changé avec 052 et 071 :
--
--   1. une séance a plusieurs groupes, il faut donc choisir lequel archive la
--      question — celui du stagiaire qui la pose, et pour un formateur le
--      premier auquel il a accès ;
--   2. une séance peut être le miroir d'une autre (`contenu_source_id`) : le
--      support vit sur la séance source, dont les groupes ne sont pas ceux du
--      stagiaire. Le rattachement accepte donc aussi les groupes des séances
--      qui tirent leur contenu de celle-ci.

create or replace function public.poser_question_support(
  p_support_id uuid,
  p_texte text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_support record;
  v_groupe uuid;
  v_id uuid;
begin
  select s.id as seance_id, s.module_id, s.date,
         coalesce(sup.contenu ->> 'titre', m.nom) as titre
    into v_support
    from public.supports_seance sup
    join public.seances s on s.id = sup.seance_id
    join public.modules m on m.id = s.module_id
   where sup.id = p_support_id;

  if v_support is null then
    raise exception 'Support introuvable.';
  end if;

  -- Les groupes qui lisent ce support : ceux de sa séance, et ceux des séances
  -- qui la prennent pour source (§4.3bis).
  with groupes_du_support as (
    select sg.groupe_id
      from public.seance_groupes sg
     where sg.seance_id = v_support.seance_id
    union
    select sg.groupe_id
      from public.seances miroir
      join public.seance_groupes sg on sg.seance_id = miroir.id
     where miroir.contenu_source_id = v_support.seance_id
  )
  select g.groupe_id
    into v_groupe
    from groupes_du_support g
   where g.groupe_id = public.groupe_du_stagiaire()
      or public.peut_acceder_groupe(g.groupe_id)
   order by (g.groupe_id = public.groupe_du_stagiaire()) desc
   limit 1;

  if v_groupe is null then
    raise exception 'Accès refusé à ce support.';
  end if;

  -- L'année scolaire se lit sur la date de la séance. La version précédente
  -- retombait sur `groupes.date_debut`, qui n'est pas une colonne : les bornes
  -- d'un groupe se déduisent de son calendrier (§4.9). Sans date de
  -- séance, le jour même fait foi — une question se pose forcément pendant
  -- l'année où elle est posée.
  insert into public.questions_support (
    support_id, module_id, groupe_id, formateur_id,
    annee_scolaire, support_titre, auteur_id, texte
  )
  select
    p_support_id,
    v_support.module_id,
    v_groupe,
    g.formateur_id,
    public.annee_scolaire(coalesce(v_support.date, current_date)),
    v_support.titre,
    auth.uid(),
    p_texte
  from public.groupes g
  where g.id = v_groupe
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.poser_question_support(uuid, text) to authenticated;
