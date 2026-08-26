-- 026 — Enregistrement de la clé LLM rendu idempotent.
--
-- `enregistrer_parametres_llm` appelait `vault.create_secret` dès que la
-- colonne `cle_secret_id` était vide, sans regarder si un secret du même nom
-- existait déjà. Or le nom est déterministe (« llm_<formateur> ») et
-- `vault.secrets` impose son unicité : dès que la colonne et le coffre se
-- désynchronisent — pointeur effacé alors que le secret survit, échec partiel,
-- intervention manuelle — l'enregistrement échoue sur
-- « duplicate key value violates unique constraint secrets_name_idx », et le
-- formateur ne peut plus enregistrer aucune clé.
--
-- La fonction retrouve désormais le secret par son nom avant d'envisager d'en
-- créer un : elle converge vers le même état quel que soit le point de départ.

create or replace function public.enregistrer_parametres_llm(
  p_fournisseur text,
  p_modele text,
  p_base_url text default null,
  p_cle text default null,
  p_max_tokens integer default 8000,
  p_temperature numeric default null
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_formateur uuid := auth.uid();
  v_secret_id uuid;
  v_nom text;
begin
  if v_formateur is null then
    raise exception 'Authentification requise.';
  end if;

  select cle_secret_id into v_secret_id
  from public.parametres_llm
  where formateur_id = v_formateur;

  if p_cle is not null and length(trim(p_cle)) > 0 then
    v_nom := 'llm_' || v_formateur::text;

    -- Le pointeur peut être vide alors que le secret existe encore : on le
    -- récupère par son nom plutôt que d'en créer un second, impossible.
    if v_secret_id is null then
      select id into v_secret_id from vault.secrets where name = v_nom;
    end if;

    if v_secret_id is null then
      v_secret_id := vault.create_secret(
        trim(p_cle), v_nom, 'Clé API LLM du formateur ' || v_formateur::text
      );
    else
      perform vault.update_secret(v_secret_id, trim(p_cle));
    end if;
  end if;

  insert into public.parametres_llm as pl (
    formateur_id, fournisseur, modele, base_url,
    cle_secret_id, max_tokens, temperature
  )
  values (
    v_formateur, p_fournisseur, trim(p_modele), nullif(trim(coalesce(p_base_url, '')), ''),
    v_secret_id, coalesce(p_max_tokens, 8000), p_temperature
  )
  on conflict (formateur_id) do update set
    fournisseur = excluded.fournisseur,
    modele = excluded.modele,
    base_url = excluded.base_url,
    cle_secret_id = coalesce(excluded.cle_secret_id, pl.cle_secret_id),
    max_tokens = excluded.max_tokens,
    temperature = excluded.temperature,
    updated_at = now();
end;
$$;

-- Symétriquement, la suppression ne doit pas laisser de secret orphelin
-- derrière elle : elle nettoie aussi par le nom.
create or replace function public.supprimer_cle_llm()
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_formateur uuid := auth.uid();
begin
  if v_formateur is null then
    raise exception 'Authentification requise.';
  end if;

  delete from vault.secrets
  where name = 'llm_' || v_formateur::text
     or id = (select cle_secret_id from public.parametres_llm where formateur_id = v_formateur);

  update public.parametres_llm
  set cle_secret_id = null, updated_at = now()
  where formateur_id = v_formateur;
end;
$$;

grant execute on function public.enregistrer_parametres_llm(text, text, text, text, integer, numeric) to authenticated;
grant execute on function public.supprimer_cle_llm() to authenticated;
