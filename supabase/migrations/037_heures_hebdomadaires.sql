-- 037 — Cible hebdomadaire par défaut du formateur.
--
-- La cible de la semaine retombait sur une constante du code — 26 heures, la
-- moyenne légale. Elle se déclare désormais, comme le volume annuel : c'est le
-- même contrat qui fixe les deux.
--
-- Les périodes de rythme (migration 035) restent prioritaires quand elles
-- existent : elles portent la variation de 27,5 h à 25 h sur l'année. Cette
-- valeur-ci s'applique aux semaines qu'aucune période ne couvre.

alter table public.parametres_formateur
  add column if not exists heures_hebdomadaires numeric(4, 1) not null default 26
    check (heures_hebdomadaires > 0 and heures_hebdomadaires <= 60);

comment on column public.parametres_formateur.heures_hebdomadaires is
  'Cible hebdomadaire appliquée aux semaines non couvertes par une période de rythme.';
