-- L'option suivie par un groupe de deuxième année.
--
-- Le cahier du formateur ne nomme pas la filière toute seule : il écrit
-- « Digital Design - Tronc Commun » en première année, et
-- « Digital Design - Option UX designer » en seconde. Le tronc commun se déduit
-- de l'année ; l'option, non — une même filière en compte plusieurs, et c'est le
-- groupe qui en suit une.
--
-- Facultative : un groupe sans option écrit « Spécialisation », qui est vrai
-- pour toute deuxième année.

alter table public.groupes
  add column if not exists option_formation text;

comment on column public.groupes.option_formation is
  'Option de deuxième année suivie par le groupe — « UX designer »… Sans elle, les documents écrivent « Spécialisation ».';
