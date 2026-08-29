-- 045 — Retirer l'exécution accordée par défaut à PUBLIC et à anon.
--
-- Postgres accorde EXECUTE à PUBLIC à la création d'une fonction. Aucune
-- migration ne l'avait jamais révoqué : les `grant execute … to authenticated`
-- semés depuis l'atome 2.1 étaient redondants, et le périmètre réel était plus
-- large que voulu — un visiteur anonyme pouvait appeler quatorze fonctions
-- `security definer`, dont celle qui enregistre une clé API.
--
-- Rien n'était exploitable : chacune vérifie auth.uid() ou
-- groupe_du_stagiaire() et échoue proprement pour un anonyme. Mais la garde
-- reposait entièrement sur la vigilance de chaque fonction. `lire_cle_llm`
-- montrait déjà le bon réflexe : c'était la seule à avoir reçu un revoke.
--
-- On repart donc de zéro : plus aucun droit implicite, et on n'accorde que ce
-- qui doit l'être, fonction par fonction.

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- ---------------------------------------------------------------------------
-- Fonctions pivot des policies RLS.
--
-- Une expression de policy est évaluée avec les droits du rôle qui interroge :
-- sans EXECUTE ici, toutes les lectures du projet échoueraient.
-- ---------------------------------------------------------------------------
grant execute on function public.peut_acceder_groupe(uuid) to authenticated;
grant execute on function public.peut_acceder_module(uuid) to authenticated;
grant execute on function public.peut_acceder_controle(uuid) to authenticated;
grant execute on function public.peut_acceder_annonce(uuid) to authenticated;
grant execute on function public.peut_acceder_question(uuid) to authenticated;
grant execute on function public.groupe_du_stagiaire() to authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions appelées explicitement par l'application, pour un compte connecté.
-- ---------------------------------------------------------------------------
grant execute on function public.lire_parametres_llm() to authenticated;
grant execute on function public.enregistrer_parametres_llm(text, text, text, text, integer, numeric) to authenticated;
grant execute on function public.supprimer_cle_llm() to authenticated;
grant execute on function public.get_sujet_pour_passation(uuid) to authenticated;
grant execute on function public.enregistrer_passation(uuid, jsonb) to authenticated;
grant execute on function public.poser_question_support(uuid, text) to authenticated;
grant execute on function public.repondre_question(uuid, text) to authenticated;

-- `lire_cle_llm` reste réservée à service_role : la clé déchiffrée ne doit
-- jamais pouvoir être demandée depuis une session utilisateur.
grant execute on function public.lire_cle_llm(uuid) to service_role;

-- `annee_scolaire` et `log_controle_changes` ne sont appelées que depuis
-- l'intérieur d'autres fonctions ou d'un trigger, qui s'exécutent avec les
-- droits de leur propriétaire : personne n'a besoin de les appeler directement.

-- ---------------------------------------------------------------------------
-- Et pour la suite : une fonction créée demain ne doit plus naître ouverte.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public;
