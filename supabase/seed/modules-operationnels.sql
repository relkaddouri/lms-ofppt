-- modules-operationnels.sql — Atome 1.5
--
-- Modules opérationnels du tronc commun réellement enseignés (PRD §4.1) :
-- M102, M104, M106, M108, chacun décliné de sa compétence du référentiel.
-- Nom et durée sont repris de la compétence ; duree_reference n'est qu'un
-- repère, la masse horaire réelle sera portée par groupe_modules (atome 1.6).
--
-- Idempotent : rejouable sans dupliquer.

-- Le nom ne reprend PAS le code : l'interface affiche le code opérationnel
-- séparément, en mono, à côté du nom (design_system).
insert into public.modules (nom, description, duree_reference, competence_id)
select
  c.nom,
  'Décliné de la compétence ' || c.numero || ' (' || c.code_officiel || ')',
  c.duree_nationale_heures,
  c.id
from public.competences c
where c.code_operationnel in ('M102', 'M104', 'M106', 'M108')
  and not exists (
    select 1 from public.modules m where m.competence_id = c.id
  );

-- Groupe DES102 : 1re année, tronc commun.
insert into public.groupes (nom)
select 'DES102'
where not exists (select 1 from public.groupes g where g.nom = 'DES102');
