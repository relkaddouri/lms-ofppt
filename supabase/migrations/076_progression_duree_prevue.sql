-- Le cumul d'heures retombe sur la durée prévue, comme partout ailleurs.
--
-- Marquer une séance « faite » ne saisit pas sa durée réalisée : le formateur
-- ne la renseigne que lorsqu'elle diffère du prévu. La vue sommait pourtant
-- `duree_realisee` seule, si bien qu'une séance faite ce matin comptait pour
-- zéro et que le tableau de bord affichait « 0 / 540 h » au lendemain d'une
-- journée de cours.
--
-- Ce n'était pas une divergence de principe mais un oubli : les trois autres
-- lectures d'heures du produit retombent déjà sur le prévu —
-- `ModuleProgression.tsx`, la courbe d'évolution du tableau de bord et
-- `calendrier.ts` écrivent toutes `duree_realisee ?? duree_prevue`. Cette vue
-- était le seul endroit à ne pas le faire, d'où une carte en contradiction
-- avec les écrans qu'elle résume.
--
-- `nb_seances_sans_duree` garde tout son sens : il ne compte plus des heures
-- perdues, il signale que le cumul repose sur du prévisionnel et non sur du
-- constaté. C'est une réserve d'exactitude, pas une alerte.

drop view if exists public.v_progression_module;

create view public.v_progression_module
with (security_invoker = true)
as
select
  gm.groupe_id,
  gm.module_id,
  gm.masse_horaire_allouee,
  gm.heures_fad as heures_fad_prevues,
  (gm.masse_horaire_allouee - gm.heures_fad) as heures_presentiel_prevues,
  coalesce(sum(coalesce(s.duree_realisee, s.duree_prevue)) filter (
    where s.statut = 'fait' and not s.est_fad), 0)::numeric
    as heures_presentiel_realisees,
  coalesce(sum(coalesce(s.duree_realisee, s.duree_prevue)) filter (
    where s.statut = 'fait' and s.est_fad), 0)::numeric
    as heures_fad_realisees,
  coalesce(sum(coalesce(s.duree_realisee, s.duree_prevue)) filter (
    where s.statut = 'fait'), 0)::numeric
    as heures_realisees,
  count(s.id) as nb_seances,
  count(s.id) filter (where s.statut = 'fait') as nb_seances_faites,
  count(s.id) filter (
    where s.statut = 'fait' and s.duree_realisee is null) as nb_seances_sans_duree
from public.groupe_modules gm
left join public.seance_groupes sg on sg.groupe_id = gm.groupe_id
left join public.seances s
       on s.id = sg.seance_id and s.module_id = gm.module_id
group by gm.groupe_id, gm.module_id, gm.masse_horaire_allouee, gm.heures_fad;

comment on view public.v_progression_module is
  'Progression en heures par groupe et module. Les heures réalisées retombent sur la durée prévue quand la durée réalisée n''est pas saisie ; nb_seances_sans_duree dit sur combien de séances cette approximation porte.';
