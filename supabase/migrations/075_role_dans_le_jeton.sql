-- Le rôle voyage dans le jeton, plutôt que d'être relu à chaque page.
--
-- `getCurrentUserRole()` n'a qu'un appelant : le layout de tout l'espace
-- formateur. Chaque page y déclenchait donc une lecture PostgREST de
-- `profils` — un aller-retour réseau par rendu, pour une valeur qui ne change
-- jamais.
--
-- C'est aussi ce qui a produit l'incident du commit 47b3df9 : PostgREST
-- refusait « JWT issued at future » un jeton tout juste renouvelé par le
-- proxy, et le `throw` du layout remplaçait l'espace entier par la page
-- d'erreur de Next. Sans lecture, plus de refus possible.
--
-- Le crochet ne suffit pas seul : il doit être activé côté Supabase
-- (Authentication → Hooks → Customize Access Token). Tant qu'il ne l'est pas,
-- le jeton ne porte pas la revendication et le code retombe sur la lecture
-- PostgREST — la migration est donc sans effet de bord si on l'applique
-- avant d'activer.

-- ── Pourquoi `role_pedago` et surtout pas `role` ──────────────────────────
--
-- Le jeton Supabase porte déjà une revendication `role`, et ce n'est pas la
-- nôtre : c'est le rôle Postgres (`authenticated`, `anon`) sur lequel
-- PostgREST fait son `set role`. L'écraser avec « formateur » ferait échouer
-- toutes les requêtes, RLS comprise. Le nom distinct rend l'erreur
-- impossible à commettre par distraction.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_role text;
  v_claims jsonb;
begin
  select p.role into v_role
  from public.profils p
  where p.id = (event->>'user_id')::uuid;

  -- Un compte sans profil — le temps que le déclencheur de création passe —
  -- laisse le jeton tel quel. L'appelant retombe sur la lecture PostgREST,
  -- exactement comme avant cette migration.
  if v_role is null then
    return event;
  end if;

  v_claims := event->'claims';
  v_claims := jsonb_set(v_claims, '{role_pedago}', to_jsonb(v_role));

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Crochet Supabase « Customize Access Token » : ajoute la revendication role_pedago (formateur / admin / stagiaire) au jeton, pour que le layout protégé n''ait plus à lire profils à chaque rendu. Jamais role, qui est le rôle Postgres de PostgREST.';

-- ── Droits ────────────────────────────────────────────────────────────────
--
-- Le crochet est appelé par le service d'authentification, qui se connecte
-- sous `supabase_auth_admin`. La fonction n'est pas `security definer` : elle
-- lit `profils` avec les droits de ce rôle, ce qui reste vérifiable ligne à
-- ligne plutôt que d'ouvrir la table en grand.

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Personne d'autre n'a à l'appeler : elle lit le rôle d'un utilisateur
-- arbitraire depuis son identifiant.
revoke execute on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

-- `profils` porte RLS. Sans politique pour ce rôle, le crochet lirait zéro
-- ligne et n'ajouterait jamais la revendication — en silence.
--
-- On accorde `select` seul, et non `all` : le crochet lit, il n'écrit pas.
-- Et on ne révoque rien aux rôles applicatifs — contrairement à l'exemple de
-- la documentation Supabase, qui suppose une table dédiée : `profils` est
-- lue par l'application elle-même.
grant select on table public.profils to supabase_auth_admin;

drop policy if exists "profils_lecture_crochet_jeton" on public.profils;
create policy "profils_lecture_crochet_jeton" on public.profils
  as permissive for select to supabase_auth_admin
  using (true);
