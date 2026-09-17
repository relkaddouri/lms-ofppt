-- 095_publier_resultat.sql — la publication d'un résultat, qui publie vraiment
--
-- Depuis la migration 077, « Publier le résultat » écrivait `publie_le`
-- directement dans `passations_controle`. Or aucune politique n'ouvre la mise
-- à jour de cette table au formateur : la base ignorait l'écriture sans
-- erreur, l'écran annonçait « Résultat publié », et aucun stagiaire n'a
-- jamais vu son résultat (0 copie publiée en base au 17/09/2026).
--
-- Même chemin que la correction (`corriger_passation`) : une fonction qui
-- vérifie que l'appelant est bien le formateur du contrôle, écrit, et dit
-- quand il n'y a rien à écrire plutôt que de se taire.

create or replace function public.publier_resultat(
  p_passation_id uuid,
  p_publier boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_controle_id uuid;
  v_note numeric;
  v_publie timestamptz;
begin
  select controle_id, note into v_controle_id, v_note
  from passations_controle
  where id = p_passation_id;

  if v_controle_id is null then
    raise exception 'Copie introuvable.';
  end if;

  if not peut_acceder_controle(v_controle_id) then
    raise exception 'Vous ne publiez pas les résultats de ce contrôle.';
  end if;

  if p_publier and v_note is null then
    raise exception 'Cette copie n''est pas encore notée : corrigez-la avant de publier.';
  end if;

  update passations_controle
     set publie_le = case when p_publier then now() else null end
   where id = p_passation_id
  returning publie_le into v_publie;

  return v_publie;
end;
$$;

revoke execute on function public.publier_resultat(uuid, boolean) from public, anon;
grant execute on function public.publier_resultat(uuid, boolean) to authenticated;
