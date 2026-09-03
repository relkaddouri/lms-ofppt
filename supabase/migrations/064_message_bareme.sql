-- Coquille dans le message de la migration précédente : « entre 0 et 40 . »
-- Un message d'erreur est du texte lu par le formateur, il se corrige.

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
  v_total numeric;
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

  select coalesce(sum(bareme), 0) into v_total
  from questions_controle
  where controle_id = v_controle_id;

  -- Un contrôle sans question barémée ne borne rien : on retombe sur le total
  -- attendu de son type plutôt que de refuser toute note.
  if v_total <= 0 then
    select case when type = 'EFM' then 40 else 20 end into v_total
    from controles where id = v_controle_id;
  end if;

  if p_note < 0 or p_note > v_total then
    raise exception 'La note doit être comprise entre 0 et %.', v_total;
  end if;

  update passations_controle
     set responses = p_responses,
         note = p_note
   where id = p_passation_id;
end;
$$;

revoke execute on function corriger_passation(uuid, jsonb, numeric) from public, anon;
grant execute on function corriger_passation(uuid, jsonb, numeric) to authenticated;
