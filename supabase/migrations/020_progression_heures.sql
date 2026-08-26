-- 020_progression_heures.sql — Atome 2.2
--
-- La progression d'un couple groupe+module se mesure en HEURES dispensées
-- rapportées à la masse horaire allouée à ce groupe, pas en nombre de séances
-- cochées : trois séances de 5 h, 2 h 15 et 2 h 15 ne valent pas « 3 sur 3 »,
-- elles valent 9,5 h sur les 115 h allouées.
--
-- C'est ce cumul qui alimentera le rappel de contrôle (atome 3.3).

create or replace view public.v_progression_module
with (security_invoker = on) as
select
  gm.groupe_id,
  gm.module_id,
  gm.masse_horaire_allouee,
  coalesce(sum(s.duree_realisee) filter (where s.statut = 'fait'), 0)
    as heures_realisees,
  count(s.id) as nb_seances,
  count(s.id) filter (where s.statut = 'fait') as nb_seances_faites,
  -- Une séance faite sans durée saisie compte pour 0 h : le cumul serait
  -- silencieusement sous-évalué. On expose le compte pour pouvoir le signaler.
  count(s.id) filter (where s.statut = 'fait' and s.duree_realisee is null)
    as nb_seances_sans_duree
from public.groupe_modules gm
left join public.seances s
  on s.groupe_id = gm.groupe_id
 and s.module_id = gm.module_id
group by gm.groupe_id, gm.module_id, gm.masse_horaire_allouee;

comment on view public.v_progression_module is
  'Cumul d heures realisees par couple groupe+module. security_invoker : la '
  'vue respecte la RLS de l appelant, elle n ouvre aucun acces supplementaire.';


-- Version publique, pour la page de partage d un groupe.
create or replace function public.get_progression_by_groupe_token(p_token uuid)
returns table (
  module_id uuid,
  module_nom text,
  code_operationnel text,
  masse_horaire_allouee numeric,
  heures_realisees numeric,
  nb_seances bigint,
  nb_seances_faites bigint
)
language sql
security definer
set search_path = public
as $$
  select
    gm.module_id,
    m.nom,
    c.code_operationnel,
    gm.masse_horaire_allouee,
    coalesce(sum(s.duree_realisee) filter (where s.statut = 'fait'), 0),
    count(s.id),
    count(s.id) filter (where s.statut = 'fait')
  from public.groupe_modules gm
  join public.groupes g on g.id = gm.groupe_id
  join public.modules m on m.id = gm.module_id
  left join public.competences c on c.id = m.competence_id
  left join public.seances s
    on s.groupe_id = gm.groupe_id and s.module_id = gm.module_id
  where g.token_public = p_token
  group by gm.module_id, m.nom, c.code_operationnel, gm.masse_horaire_allouee,
           c.numero
  order by c.numero nulls last, m.nom;
$$;

revoke all on function public.get_progression_by_groupe_token(uuid) from public;
grant execute on function public.get_progression_by_groupe_token(uuid) to anon;
grant execute on function public.get_progression_by_groupe_token(uuid) to authenticated;
