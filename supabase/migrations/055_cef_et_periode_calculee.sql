-- Deux corrections de modèle demandées à l'usage.
--
-- 1. La période d'un groupe ne se saisit pas : elle se déduit des séances que
--    le motif hebdomadaire a placées (PRD §4.9). Deux dates saisies à la main
--    à la création d'un groupe ne pouvaient que diverger de la réalité.
--
-- 2. Le CEF — le numéro que l'OFPPT attribue à chaque stagiaire — est ce que
--    le formateur a sous la main dans ses listes officielles. Il devient
--    l'identifiant de connexion à l'espace stagiaire, l'adresse e-mail
--    restant possible pour ceux qui en ont une.

alter table public.groupes
  drop column if exists date_debut,
  drop column if exists date_fin;

alter table public.stagiaires
  add column if not exists cef text;

-- Un CEF identifie une personne : deux stagiaires ne peuvent pas le partager.
create unique index if not exists stagiaires_cef_unique
  on public.stagiaires (cef)
  where cef is not null;

comment on column public.stagiaires.cef is
  'Code d''Enregistrement du Formé, attribué par l''OFPPT. Sert aussi '
  'd''identifiant de connexion à l''espace stagiaire.';

-- Résolution CEF → adresse de connexion, appelée avant l'authentification.
--
-- `security definer` et volontairement étroite : elle ne renvoie qu'une
-- adresse déjà connue du stagiaire qui la saisit, jamais la liste des
-- stagiaires ni quoi que ce soit d'autre. Sans elle, il faudrait ouvrir
-- `stagiaires` en lecture anonyme.
create or replace function public.email_du_cef(p_cef text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
    from public.stagiaires s
    join auth.users u on u.id = s.user_id
   where s.cef = trim(p_cef)
     and s.user_id is not null
   limit 1;
$$;

revoke execute on function public.email_du_cef(text) from public;
grant execute on function public.email_du_cef(text) to anon, authenticated;
