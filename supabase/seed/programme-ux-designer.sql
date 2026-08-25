-- programme-ux-designer.sql — données réelles du référentiel officiel (atome 1.1)
--
-- Source : docs/programme-ux-designer.docx, « Programme de formation », version 2
-- du 19/07/2022, année d'approbation 2021.
--
-- Deux réserves consignées telles quelles :
--   * Le document annonce une durée totale de 1435 h (trois occurrences), alors
--     que la somme des durées des 16 compétences du tableau synthèse vaut 1375 h.
--     Les deux valeurs sont enregistrées sans arbitrage : 1435 h sur la spécialité,
--     les durées unitaires sur chaque compétence.
--   * Le document ne contient aucun code court M1XX. Le code opérationnel est donc
--     DÉRIVÉ du numéro selon le motif documenté au PRD §3 (M1 + numéro sur 2
--     chiffres, ex. compétence 6 -> M106), et non lu dans le référentiel.
--
-- Idempotent : rejouable sans dupliquer.

insert into public.specialites (nom, code, duree_totale_heures)
values ('Digital Design - Option UX Design', 'DIA_DES_TS', 1435)
on conflict (code) do update
  set nom = excluded.nom, duree_totale_heures = excluded.duree_totale_heures;

insert into public.programmes (specialite_id, annee_approbation)
select id, 2021 from public.specialites where code = 'DIA_DES_TS'
on conflict (specialite_id, annee_approbation) do nothing;

insert into public.competences
  (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures)
values
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 1, 'DIA_DES_TS-01', 'M101', 'Se situer au regard du métier et de la démarche de formation', 15),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 2, 'DIA_DES_TS-02', 'M102', 'Identifier les enjeux digitaux chez l’utilisateur', 60),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 3, 'DIA_DES_TS-03', 'M103', 'Exploiter les règles du graphisme dans les solutions digitales', 105),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 4, 'DIA_DES_TS-04', 'M104', 'Analyser le contexte professionnel d’un projet d’UX / UI Design', 90),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 5, 'DIA_DES_TS-05', 'M105', 'Réaliser une veille graphique', 90),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 6, 'DIA_DES_TS-06', 'M106', 'Déterminer les concepts de l’UX/UI Design', 120),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 7, 'DIA_DES_TS-07', 'M107', 'Utiliser les logiciels de modélisation graphique', 120),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 8, 'DIA_DESOUX_TS-08', 'M108', 'S’initier à la création et l’utilisation d’interactions digitales', 105),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 9, 'DIA_DESOUX_TS-09', 'M109', 'S’initier à la gestion de projet', 30),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 10, 'DIA_DESOUX_TS-10', 'M110', 'Analyser les besoins des utilisateurs', 90),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 11, 'DIA_DESOUX_TS-11', 'M111', 'Déterminer les parcours utilisateurs', 105),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 12, 'DIA_DESOUX_TS-12', 'M112', 'Connaître les spécificités de l’ergonomie de différents types de solutions', 75),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 13, 'DIA_DESOUX_TS-13', 'M113', 'Créer un design d’interfaces ergonomique et interactif', 60),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 14, 'DIA_DESOUX_TS-14', 'M114', 'Architecturer des informations', 60),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 15, 'DIA_DESOUX_TS-15', 'M115', 'Réaliser des tests utilisateurs', 90),
  ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 16, 'DIA_DESOUX_TS-16', 'M116', 'S''intégrer en milieu professionnel', 160)
on conflict (programme_id, numero) do update
  set code_officiel = excluded.code_officiel,
      code_operationnel = excluded.code_operationnel,
      nom = excluded.nom,
      duree_nationale_heures = excluded.duree_nationale_heures;
