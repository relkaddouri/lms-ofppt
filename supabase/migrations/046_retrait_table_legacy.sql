-- 046 — Retirer l'ancienne table de fiches rattachées au module.
--
-- La migration 027 avait renommé `fiches_preparation` en
-- `fiches_prescrites_legacy` et fixé elle-même la condition de sa
-- suppression : « à supprimer une fois la Phase 1 validée ». La Phase 1 est
-- close depuis une trentaine d'atomes, la table ne contient plus qu'une ligne,
-- dont le contenu a été remis au formateur avant cette migration.
--
-- Elle portait encore trois policies RLS et apparaissait dans chaque
-- inventaire de schéma : c'est du bruit, pas une sauvegarde.

drop table if exists public.fiches_prescrites_legacy;
