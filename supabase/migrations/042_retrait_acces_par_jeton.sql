-- 042 — Retrait des accès par lien public.
--
-- L'atome 4.1 demandait de supprimer toute logique reposant sur token_public.
-- Le retrait était différé jusqu'à ce que l'atome 4.5 apporte le remplacement :
-- priver les stagiaires de passation entre les deux n'aurait servi personne.
-- Ce remplacement existe, la passation se fait par compte, ces fonctions
-- peuvent partir.
--
-- Ce qu'elles avaient de dangereux : un jeton ne distingue personne. Qui
-- l'obtenait voyait le groupe entier, ses séances, ses annonces, et pouvait
-- composer autant de fois qu'il voulait sous n'importe quel nom.

drop function if exists public.get_groupe_by_token(uuid);
drop function if exists public.get_seances_by_groupe_token(uuid);
drop function if exists public.get_annonces_by_token(uuid);
drop function if exists public.get_progression_by_groupe_token(uuid);
drop function if exists public.get_controle_by_token(uuid);
drop function if exists public.get_questions_by_controle_token(uuid);
drop function if exists public.get_formateur_by_controle_token(uuid);

-- La correction s'appuie désormais sur enregistrer_passation, qui identifie le
-- stagiaire par son compte.
drop function if exists public.submit_passation(uuid, jsonb);
drop function if exists public.get_questions_with_corrige_for_scoring(uuid);

-- Les colonnes elles-mêmes disparaissent : une valeur qu'aucun chemin ne lit
-- mais qui traîne en base finit par être réutilisée sans réfléchir.
alter table public.controles drop column if exists token_public;
alter table public.groupes drop column if exists token_public;
