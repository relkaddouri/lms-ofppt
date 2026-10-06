-- La fiche d'identité du cahier du formateur.
--
-- Le cahier officiel de l'OFPPT s'ouvre sur un tableau d'identité en quatorze
-- lignes. La plateforme en connaissait six — nom, matricule, établissement,
-- code secteur, niveau de formation, année scolaire. Les huit autres se
-- recopiaient à la main dans Word à chaque édition du classeur, et la copie à
-- la main se trompe.
--
-- Elles rejoignent donc les paramètres du formateur : saisies une fois, elles
-- resservent chaque année.
--
-- Toutes facultatives et nulles au départ : un compte existant ne devient pas
-- incomplet du fait de cette migration, et le cahier sort avec des cases vides
-- plutôt que de refuser de s'éditer.

alter table public.parametres_formateur
  add column if not exists date_recrutement date,
  add column if not exists grade text,
  add column if not exists echelon text,
  add column if not exists diplome text,
  add column if not exists specialite_origine text,
  add column if not exists specialite_affectation text,
  add column if not exists date_affectation date,
  add column if not exists date_dernier_bilan date;

comment on column public.parametres_formateur.date_recrutement is
  'Date de recrutement, telle qu''elle figure sur la fiche d''identité du cahier du formateur.';
comment on column public.parametres_formateur.grade is
  'Grade statutaire — « Cadre », « Technicien spécialisé »… Texte libre : la nomenclature change et n''a pas à être figée ici.';
comment on column public.parametres_formateur.echelon is
  'Échelon dans le grade. Texte et non nombre : certains s''écrivent « 01 », avec leur zéro.';
comment on column public.parametres_formateur.diplome is
  'Diplôme le plus élevé, tel qu''il doit paraître sur le cahier.';
comment on column public.parametres_formateur.specialite_origine is
  'Spécialité d''origine du formateur, qui n''est pas toujours celle où il enseigne.';
comment on column public.parametres_formateur.specialite_affectation is
  'Spécialité d''affectation : celle de la filière prise en charge.';
comment on column public.parametres_formateur.date_affectation is
  'Date d''affectation à l''établissement ou à la filière.';
comment on column public.parametres_formateur.date_dernier_bilan is
  'Date du dernier bilan de compétence. Souvent vide, et le cahier l''accepte : il porte alors un tiret.';
