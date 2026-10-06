-- La direction régionale, première ligne de la couverture du cahier.
--
-- La migration 113 a ramené les dix lignes de la fiche d'identité. La
-- couverture, elle, en demande trois : la direction régionale,
-- l'établissement et l'année de formation. Les deux dernières existent déjà ;
-- la première n'a jamais eu de place.
--
-- Facultative comme les autres : un cahier sort avec la ligne vide plutôt que
-- de refuser de s'éditer.

alter table public.parametres_formateur
  add column if not exists direction_regionale text;

comment on column public.parametres_formateur.direction_regionale is
  'Direction régionale de l''OFPPT — « SOUSS MASSA »… Telle qu''elle figure sur la couverture du cahier du formateur.';
