-- 023 — Paramètres LLM par formateur, clé API chiffrée dans Vault.
--
-- Le fournisseur n'est plus figé dans le code : chaque formateur choisit le
-- sien (Anthropic, OpenAI, DeepSeek, ou toute API compatible OpenAI) et fournit
-- sa propre clé. La clé n'est jamais stockée en clair : Vault la chiffre, la
-- table ne garde que l'identifiant du secret.
--
-- La table n'est accessible à personne directement. Ni en lecture ni en
-- écriture, pas même à son propriétaire : tout passe par les trois fonctions
-- ci-dessous. C'est ce qui garantit que `cle_secret_id` ne fuite pas vers le
-- navigateur, et que la clé déchiffrée n'est lisible que par le serveur.

create extension if not exists supabase_vault with schema vault;

create table if not exists public.parametres_llm (
  id uuid primary key default gen_random_uuid(),
  formateur_id uuid not null unique references auth.users (id) on delete cascade,
  fournisseur text not null
    check (fournisseur in ('anthropic', 'openai', 'deepseek', 'compatible')),
  modele text not null check (length(trim(modele)) > 0),
  -- Renseignée uniquement pour « compatible » : les trois autres fournisseurs
  -- ont une URL connue, imposée côté application.
  base_url text,
  cle_secret_id uuid,
  max_tokens integer not null default 8000 check (max_tokens between 256 and 128000),
  -- Ignorée par les modèles Claude récents, qui rejettent le paramètre.
  temperature numeric(3, 2) check (temperature between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint base_url_requise_si_compatible
    check (fournisseur <> 'compatible' or base_url is not null)
);

comment on table public.parametres_llm is
  'Configuration du fournisseur LLM par formateur. Inaccessible directement : passer par lire_parametres_llm / enregistrer_parametres_llm / lire_cle_llm.';
comment on column public.parametres_llm.cle_secret_id is
  'Identifiant du secret Vault. La clé elle-même n''est jamais dans cette table.';

alter table public.parametres_llm enable row level security;

-- Aucune policy : RLS activée sans policy = table fermée à tous les rôles
-- soumis à RLS. Le service_role la contourne, ce qui suffit aux fonctions
-- security definer.
revoke all on public.parametres_llm from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lecture : tout sauf la clé.
-- ---------------------------------------------------------------------------
create or replace function public.lire_parametres_llm()
returns table (
  fournisseur text,
  modele text,
  base_url text,
  max_tokens integer,
  temperature numeric,
  cle_definie boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, vault
as $$
  select
    p.fournisseur,
    p.modele,
    p.base_url,
    p.max_tokens,
    p.temperature,
    p.cle_secret_id is not null as cle_definie,
    p.updated_at
  from public.parametres_llm p
  where p.formateur_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Écriture. p_cle vide ou nulle = « ne touche pas à la clé existante », ce qui
-- permet de changer de modèle sans avoir à ressaisir la clé.
-- ---------------------------------------------------------------------------
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
    -- Ne jamais effacer une clé déjà posée quand l'appel n'en fournit pas.
    cle_secret_id = coalesce(excluded.cle_secret_id, pl.cle_secret_id),
    max_tokens = excluded.max_tokens,
    temperature = excluded.temperature,
    updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Suppression de la clé seule (le reste de la configuration est conservé).
-- ---------------------------------------------------------------------------
create or replace function public.supprimer_cle_llm()
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select cle_secret_id into v_secret_id
  from public.parametres_llm
  where formateur_id = auth.uid();

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
    update public.parametres_llm
    set cle_secret_id = null, updated_at = now()
    where formateur_id = auth.uid();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Déchiffrement. Réservé au serveur : jamais exposé au navigateur.
-- ---------------------------------------------------------------------------
create or replace function public.lire_cle_llm(p_formateur uuid)
returns table (
  fournisseur text,
  modele text,
  base_url text,
  max_tokens integer,
  temperature numeric,
  cle text
)
language sql
security definer
set search_path = public, vault
as $$
  select
    p.fournisseur,
    p.modele,
    p.base_url,
    p.max_tokens,
    p.temperature,
    s.decrypted_secret
  from public.parametres_llm p
  left join vault.decrypted_secrets s on s.id = p.cle_secret_id
  where p.formateur_id = p_formateur;
$$;

revoke all on function public.lire_cle_llm(uuid) from public, anon, authenticated;
grant execute on function public.lire_cle_llm(uuid) to service_role;

grant execute on function public.lire_parametres_llm() to authenticated;
grant execute on function public.enregistrer_parametres_llm(text, text, text, text, integer, numeric) to authenticated;
grant execute on function public.supprimer_cle_llm() to authenticated;
