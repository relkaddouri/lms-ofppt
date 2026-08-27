-- 030 — Toute séance porte un objectif d'apprentissage et une nature.
--
-- C'est l'objectif pédagogique qui fonde la fiche de préparation et le support :
-- sans lui, la génération ne peut s'appuyer que sur le nom du module, et rend
-- le même contenu pour toutes les séances. La nature (théorique / pratique)
-- vient de la répartition et détermine ce qu'on produit — un cours ou un TP.

alter table public.seances
  add column if not exists suggestion_pedagogique_id uuid
    references public.suggestions_pedagogiques (id) on delete set null,
  add column if not exists nature text
    check (nature is null or nature in ('theorique', 'pratique'));

comment on column public.seances.suggestion_pedagogique_id is
  'Objectif d''apprentissage traité par la séance (A.1, B.2…). Renseigné par le plan de déroulement.';
comment on column public.seances.nature is
  'theorique ou pratique. Détermine la fiche et le support produits.';

create index if not exists seances_objectif_idx
  on public.seances (suggestion_pedagogique_id);

-- La colonne reste nullable : quatre séances antérieures au plan de déroulement
-- existent déjà, et aucune règle ne permet de leur attribuer un objectif
-- rétroactivement. Les séances issues du plan le portent toujours.
