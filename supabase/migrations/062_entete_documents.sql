-- Champs d'en-tête du tableau de service (PRD §4.13bis).
--
-- Le document officiel porte un bloc d'identité que rien dans le schéma ne
-- détermine : Code Secteur, Formateur, Spécialité, Niveau de formation, Année
-- scolaire, et un matricule au pied, dans le cadre de signature. Seule la
-- spécialité se déduit — elle vient des groupes du formateur ; les autres se
-- règlent, à côté du nom et du logo de l'établissement (migration 059).
--
-- Le nom du formateur ne figurait pas dans la liste d'origine mais manquait
-- tout autant : à défaut, le tableau imprimait l'adresse e-mail du compte,
-- là où le document signé porte « Rachid EL KADDOURI ».

alter table public.parametres_formateur
  add column if not exists nom_formateur text,
  add column if not exists matricule text,
  add column if not exists code_secteur text,
  add column if not exists niveau_formation text,
  add column if not exists annee_scolaire text;

comment on column public.parametres_formateur.nom_formateur is
  'Nom du formateur tel qu''il signe les documents. À défaut, l''adresse du compte.';
comment on column public.parametres_formateur.matricule is
  'Matricule OFPPT, porté par le cadre de signature du tableau de service.';
comment on column public.parametres_formateur.code_secteur is
  'Code Secteur de l''en-tête du tableau de service, par exemple « Pôle DIA ».';
comment on column public.parametres_formateur.niveau_formation is
  'Niveau de formation, par exemple « TS » pour technicien spécialisé.';
comment on column public.parametres_formateur.annee_scolaire is
  'Année scolaire au format AAAA/AAAA. Elle ne se déduit pas de la date : '
  'un tableau se rédige aussi bien avant la rentrée qu''en cours d''année.';

-- Une année mal formée ne se verrait qu'à l'impression du document.
alter table public.parametres_formateur
  drop constraint if exists parametres_formateur_annee_scolaire;
alter table public.parametres_formateur
  add constraint parametres_formateur_annee_scolaire
  check (annee_scolaire is null or annee_scolaire ~ '^[0-9]{4}/[0-9]{4}$');
