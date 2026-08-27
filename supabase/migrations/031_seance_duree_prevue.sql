-- 031 — Durée prévue d'une séance.
--
-- `duree_realisee` enregistre ce qui a effectivement été fait. Le plan de
-- déroulement a besoin de l'autre moitié : ce qui est prévu, avant même qu'une
-- date soit posée. Les deux coexistent — c'est leur écart qui mesure le retard
-- d'un groupe sur son module.

alter table public.seances
  add column if not exists duree_prevue numeric(4, 2)
    check (duree_prevue is null or duree_prevue > 0);

comment on column public.seances.duree_prevue is
  'Durée planifiée, posée par le plan de déroulement. À comparer à duree_realisee.';
