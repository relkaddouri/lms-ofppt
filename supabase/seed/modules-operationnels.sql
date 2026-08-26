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
-- formateur_id est renseigne explicitement : `default auth.uid()` vaut NULL
-- quand le seed est joue par le role service, et la ligne serait invisible.
insert into public.modules (nom, description, duree_reference, competence_id, formateur_id)
select
  c.nom,
  'Décliné de la compétence ' || c.numero || ' (' || c.code_officiel || ')',
  c.duree_nationale_heures,
  c.id,
  (select p.id from public.profils p where (select count(*) from public.profils) = 1)
from public.competences c
where c.code_operationnel in ('M102', 'M104', 'M106', 'M108')
  and not exists (
    select 1 from public.modules m where m.competence_id = c.id
  );

-- Groupe DES102 : 1re année, tronc commun.
insert into public.groupes (nom, formateur_id)
select 'DES102',
       (select p.id from public.profils p where (select count(*) from public.profils) = 1)
where not exists (select 1 from public.groupes g where g.nom = 'DES102');
