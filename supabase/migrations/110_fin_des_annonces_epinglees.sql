-- Fin du retour en arrière des annonces épinglées.
--
-- Le lot « les annonces se classent et s'épinglent » a été abandonné en cours
-- de route, et son code retiré du dépôt. Sa migration, elle, avait déjà été
-- appliquée : la base portait depuis deux colonnes, une contrainte et un index
-- que plus une ligne de code ne regardait, et son fichier n'existait plus pour
-- le dire.
--
-- Cette divergence n'était pas qu'inélégante : elle empêchait toute migration
-- suivante. La CLI refuse de pousser quand une version enregistrée en base n'a
-- pas de fichier en regard — « Remote migration versions not found in local
-- migrations directory » — et aucun travail touchant au schéma ne pouvait plus
-- avancer. L'historique distant a donc été réparé
-- (`migration repair --status reverted 110`), et ce fichier reprend le numéro
-- pour défaire ce que l'ancien avait fait.
--
-- Rien n'est perdu : avant écriture, les 22 annonces ont été relues, aucune
-- n'était épinglée, et `genre` valait partout sa valeur par défaut. Ces
-- colonnes ne portaient aucune information. L'export des 22 lignes est
-- conservé hors du dépôt, dans `.backups/annonces-110-avant-drop.json`.
--
-- Si le sujet revient un jour, c'est le commit c245d28 qu'il faut relire : il
-- tient le schéma et les écrans d'origine.

-- L'index et la contrainte partiraient d'eux-mêmes avec leur colonne. On les
-- nomme quand même : une migration de retrait se relit mieux quand elle dit
-- tout ce qu'elle emporte.
drop index if exists public.annonces_epinglees_idx;

alter table public.annonces
  drop constraint if exists annonces_genre_check;

alter table public.annonces
  drop column if exists epinglee,
  drop column if exists genre;
