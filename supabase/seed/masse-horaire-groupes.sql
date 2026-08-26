-- masse-horaire-groupes.sql — Atome 1.6
--
-- Données réelles du PRD §4.1 : le même module n'a pas la même masse horaire
-- selon le groupe. C'est le cœur de cet atome.
--
--   Module | DES101 | DES102
--   M102   |   55 h |   45 h
--   M104   |   80 h |   65 h
--   M106   |  110 h |   85 h
--   M108   |   95 h |   80 h
--
-- EGTSI106 (40 h / 25 h dans le PRD) est un module transversal hors des
-- 16 compétences de la spécialité : il n'existe pas encore comme module.
--
-- Idempotent : rejouable sans dupliquer ni écraser une saisie ultérieure
-- autre que celles listées ici.

-- Année et spécialité des groupes réels.
update public.groupes set annee = 1 where nom in ('DES101', 'DES102');
update public.groupes
set annee = 2,
    specialite_id = (select id from public.specialites where code = 'DIA_DES_TS')
where nom = 'DDOUX201';

-- Assignations groupe+module avec leur masse horaire propre.
insert into public.groupe_modules (groupe_id, module_id, masse_horaire_allouee, formateur_id)
select g.id, m.id, v.heures,
       -- Un seul profil formateur existe aujourd'hui ; sinon on laisse null.
       (select p.id from public.profils p
        where (select count(*) from public.profils) = 1)
from (values
  ('DES101', 'M102',  55),
  ('DES101', 'M104',  80),
  ('DES101', 'M106', 110),
  ('DES101', 'M108',  95),
  ('DES102', 'M102',  45),
  ('DES102', 'M104',  65),
  ('DES102', 'M106',  85),
  ('DES102', 'M108',  80)
) as v(groupe, code, heures)
join public.groupes g on g.nom = v.groupe
join public.modules m on m.competence_id = (
  select c.id from public.competences c where c.code_operationnel = v.code
)
on conflict (groupe_id, module_id) do update
  set masse_horaire_allouee = excluded.masse_horaire_allouee,
      formateur_id = coalesce(excluded.formateur_id, public.groupe_modules.formateur_id);
