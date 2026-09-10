-- Retirer une photo, sans cast côté application.
--
-- `enregistrer_photo_stagiaire` recevait `p_chemin text`, sans valeur par
-- défaut. Les types générés le déclarent donc obligatoire et non nul, alors
-- que le retrait consiste précisément à passer `null` : l'appel ne compilait
-- qu'au prix d'un cast, c'est-à-dire en éteignant la vérification sur toute la
-- requête — la dette exacte que les points de vigilance du backlog décrivent.
--
-- Le paramètre prend donc une valeur par défaut. Omettre l'argument devient la
-- façon de dire « plus de photo », ce qui se lit mieux qu'un `null` explicite
-- et se type sans rien désactiver. `nullif` couvre le cas de la chaîne vide,
-- qu'un formulaire peut produire là où il voulait dire « rien ».
create or replace function public.enregistrer_photo_stagiaire(
  p_stagiaire uuid,
  p_chemin text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.peut_gerer_photo(p_stagiaire) then
    raise exception 'Accès refusé à cette fiche.';
  end if;

  update public.stagiaires
     set photo = nullif(trim(coalesce(p_chemin, '')), '')
   where id = p_stagiaire;
end;
$$;

grant execute on function public.enregistrer_photo_stagiaire(uuid, text) to authenticated;
