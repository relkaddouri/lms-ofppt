-- Le rôle d'un compte ne se change pas depuis l'application.
--
-- `profils_update_own` (migration 002) autorise chaque compte à modifier sa
-- propre ligne, sans `with check`. La table ne portait jusqu'ici que le rôle :
-- un stagiaire pouvait donc s'écrire « formateur » et entrer dans l'espace de
-- gestion — les policies métier s'appuient toutes sur ce rôle. Personne ne
-- l'avait fait, mais rien ne l'en empêchait.
--
-- La migration 106 ouvre cette même ligne à l'écriture depuis un écran de
-- réglages : le trou devient un chemin balisé. On le ferme avant d'y passer.
--
-- Un déclencheur plutôt qu'un `with check` : la valeur de référence est celle
-- de la ligne d'avant, que `old` donne directement. L'exprimer dans la policy
-- demanderait une sous-requête sur la table que la policy protège.
create or replace function public.profils_role_fige()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seulement depuis PostgREST : l'administration de la base, la clé de
  -- service et les migrations continuent d'attribuer les rôles.
  if current_user = 'authenticated' and new.role is distinct from old.role then
    raise exception 'Le rôle d''un compte ne se change pas depuis l''application.';
  end if;
  return new;
end;
$$;

comment on function public.profils_role_fige() is
  'Refuse tout changement de profils.role venant d''une session PostgREST authentifiée : sans lui, profils_update_own laissait un compte s''attribuer le rôle formateur.';

drop trigger if exists profils_role_fige on public.profils;
create trigger profils_role_fige
  before update on public.profils
  for each row execute function public.profils_role_fige();
