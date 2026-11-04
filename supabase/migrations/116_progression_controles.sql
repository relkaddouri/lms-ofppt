-- Les heures des contrôles, rangées dans leur module.
--
-- Demande du formateur (04/11/2026) : l'EFM de M202 passé le 14/10 sur un
-- créneau de M203 comptait ses 5 h en M203 — la séance du jour, marquée
-- faite — et rien en M202. La page Progression suit déjà la règle validée
-- (`compterControles`, lib/progression.ts) ; cette vue, lue par le tableau de
-- bord, la suit désormais aussi, sinon la carte contredirait l'écran qu'elle
-- résume (même raison que la migration 076).
--
-- Règles, identiques à lib/progression.ts :
-- - seuls les CC et les EFM validés dont le jour est passé comptent ;
-- - un contrôle compte sa durée saisie ; un EFM compte en plus le reste du
--   créneau, consacré à la correction (4 h d'épreuve sur 5 h : 4 h + 1 h) ;
-- - passé un jour où son module a une séance, il est déjà dans ses heures ;
-- - sinon, sur la première séance du jour d'un autre module : ses heures
--   quittent ce module (si la séance est faite) pour le sien ;
-- - un jour sans séance, elles s'ajoutent à son module.
--
-- Les heures d'un contrôle se rangent en présentiel ; celles retirées le sont
-- du côté (présentiel ou FAD) de la séance qui a cédé son créneau.

drop view if exists public.v_progression_module;

create view public.v_progression_module
with (security_invoker = true)
as
with controles_passes as (
  select c.id, c.groupe_id, c.module_id, c.type, c.date_prevue,
         coalesce(c.duree_heures, 0)::numeric as heures
  from public.controles c
  where c.type in ('CC', 'EFM')
    and c.statut = 'valide'
    and c.groupe_id is not null
    and c.date_prevue is not null
    and c.date_prevue <= (now() at time zone 'Africa/Casablanca')::date
),
-- La séance qui a accueilli le contrôle : nulle si son propre module avait
-- séance ce jour-là, ou si le groupe n'avait aucune séance.
situes as (
  select cp.*,
         exists (
           select 1
           from public.seance_groupes sg
           join public.seances s on s.id = sg.seance_id
           where sg.groupe_id = cp.groupe_id
             and s.date = cp.date_prevue
             and s.module_id = cp.module_id
         ) as chez_lui,
         hote.module_id as hote_module_id,
         hote.statut as hote_statut,
         hote.est_fad as hote_fad,
         coalesce(hote.duree_realisee, hote.duree_prevue, 0)::numeric
           as duree_creneau
  from controles_passes cp
  left join lateral (
    select s.module_id, s.statut, s.est_fad, s.duree_realisee, s.duree_prevue
    from public.seance_groupes sg
    join public.seances s on s.id = sg.seance_id
    where sg.groupe_id = cp.groupe_id
      and s.date = cp.date_prevue
    order by s.heure_debut nulls last, s.created_at
    limit 1
  ) hote on true
),
comptes as (
  select st.*,
         case
           when st.hote_module_id is not null and st.duree_creneau > 0
             then least(st.heures, st.duree_creneau)
           else st.heures
         end as epreuve
  from situes st
  where not st.chez_lui
),
mouvements as (
  -- Ce que gagne le module du contrôle.
  select groupe_id, module_id, false as fad,
         epreuve + case when type = 'EFM' and hote_module_id is not null
                        then greatest(0, duree_creneau - epreuve) else 0 end
           as heures
  from comptes
  union all
  -- Ce que perd le module dont la séance a cédé son créneau.
  select groupe_id, hote_module_id, hote_fad,
         -(epreuve + case when type = 'EFM'
                          then greatest(0, duree_creneau - epreuve) else 0 end)
  from comptes
  where hote_module_id is not null and hote_statut = 'fait'
),
par_module as (
  select groupe_id, module_id,
         sum(heures) filter (where not fad) as presentiel,
         sum(heures) filter (where fad) as fad
  from mouvements
  group by groupe_id, module_id
),
seances_faites as (
  select
    gm.groupe_id,
    gm.module_id,
    gm.masse_horaire_allouee,
    gm.heures_fad,
    coalesce(sum(coalesce(s.duree_realisee, s.duree_prevue)) filter (
      where s.statut = 'fait' and not s.est_fad), 0)::numeric as presentiel,
    coalesce(sum(coalesce(s.duree_realisee, s.duree_prevue)) filter (
      where s.statut = 'fait' and s.est_fad), 0)::numeric as fad,
    count(s.id) as nb_seances,
    count(s.id) filter (where s.statut = 'fait') as nb_seances_faites,
    count(s.id) filter (
      where s.statut = 'fait' and s.duree_realisee is null) as nb_seances_sans_duree
  from public.groupe_modules gm
  left join public.seance_groupes sg on sg.groupe_id = gm.groupe_id
  left join public.seances s
         on s.id = sg.seance_id and s.module_id = gm.module_id
  group by gm.groupe_id, gm.module_id, gm.masse_horaire_allouee, gm.heures_fad
)
select
  sf.groupe_id,
  sf.module_id,
  sf.masse_horaire_allouee,
  sf.heures_fad as heures_fad_prevues,
  (sf.masse_horaire_allouee - sf.heures_fad) as heures_presentiel_prevues,
  sf.presentiel + coalesce(pm.presentiel, 0) as heures_presentiel_realisees,
  sf.fad + coalesce(pm.fad, 0) as heures_fad_realisees,
  sf.presentiel + sf.fad + coalesce(pm.presentiel, 0) + coalesce(pm.fad, 0)
    as heures_realisees,
  sf.nb_seances,
  sf.nb_seances_faites,
  sf.nb_seances_sans_duree
from seances_faites sf
left join par_module pm
       on pm.groupe_id = sf.groupe_id and pm.module_id = sf.module_id;

comment on view public.v_progression_module is
  'Progression en heures par groupe et module, contrôles compris : un CC ou un EFM passé sur le créneau d''un autre module compte pour le sien (règles dans lib/progression.ts). Les heures réalisées retombent sur la durée prévue quand la durée réalisée n''est pas saisie.';
