-- Correction d'une copie par le formateur.
--
-- `passations_controle` n'avait que des politiques SELECT : une copie corrigée
-- automatiquement à la remise était figée, le formateur ne pouvait ni reprendre
-- une note ni écrire un commentaire au stagiaire. L'écran de correction repose
-- sur cette fonction plutôt que sur une politique UPDATE, pour que seules les
-- deux colonnes concernées bougent — la réponse rendue par le stagiaire, elle,
-- ne se réécrit pas.

create or replace function corriger_passation(
  p_passation_id uuid,
  p_responses jsonb,
  p_note numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_controle_id uuid;
begin
  select controle_id into v_controle_id
  from passations_controle
  where id = p_passation_id;

  if v_controle_id is null then
    raise exception 'Copie introuvable.';
  end if;

  if not peut_acceder_controle(v_controle_id) then
    raise exception 'Vous ne corrigez pas ce contrôle.';
  end if;

  if p_note < 0 or p_note > 20 then
    raise exception 'La note doit être comprise entre 0 et 20.';
  end if;

  update passations_controle
     set responses = p_responses,
         note = p_note
   where id = p_passation_id;
end;
$$;

revoke execute on function corriger_passation(uuid, jsonb, numeric) from public, anon;
grant execute on function corriger_passation(uuid, jsonb, numeric) to authenticated;
