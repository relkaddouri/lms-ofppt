-- 034 — Dates réglementaires de l'épreuve de fin de module régionale.
--
-- Une EFM locale est fixée par le formateur : sa date est une estimation, qu'il
-- ajuste. Une EFM régionale ne lui appartient pas — elle est arrêtée par la
-- région, et s'accompagne d'une date d'envoi des propositions de sujets, en
-- amont de l'épreuve. Les deux dates se saisissent, elles ne se calculent pas.

alter table public.controles
  add column if not exists date_envoi_propositions date;

comment on column public.controles.date_envoi_propositions is
  'EFM régionale : date limite d''envoi des propositions de sujets à la région. Sans objet pour un CC ou une EFM locale.';

-- Une date d'envoi n'a de sens qu'avant l'épreuve elle-même.
alter table public.controles
  drop constraint if exists controles_envoi_avant_epreuve;
alter table public.controles
  add constraint controles_envoi_avant_epreuve
  check (
    date_envoi_propositions is null
    or date_prevue is null
    or date_envoi_propositions <= date_prevue
  );
