-- 028 — Champs nécessaires à la génération du manuel de formateur.
--
-- Le manuel de formateur (« Guide de soutien pédagogique ») n'est pas un
-- document à importer : tout son contenu vient du programme officiel, déjà en
-- base depuis la Phase 1. Il manquait quatre informations de la section 1.1 et
-- les modes d'apprentissage de la section 2.2.
--
-- Ce qui n'est PAS ajouté ici, volontairement : les masses horaires par
-- objectif. Le manuel officiel les laisse en « ? » — les remplir à partir de
-- la masse horaire réellement allouée au groupe est le travail que
-- l'application doit reprendre, et il dépend du groupe, pas de la compétence.

alter table public.competences
  add column if not exists enonce_competence text,
  add column if not exists description_generale text,
  add column if not exists pct_theorique numeric(4, 1),
  add column if not exists pct_pratique numeric(4, 1),
  add column if not exists pct_evaluation numeric(4, 1);

comment on column public.competences.pct_theorique is
  'Part théorique de la masse horaire, telle qu''annoncée par le manuel (60 % sur les compétences observées).';

alter table public.competences
  add constraint competences_pct_coherents
  check (
    pct_theorique is null or pct_pratique is null or pct_evaluation is null
    or abs((pct_theorique + pct_pratique + pct_evaluation) - 100) <= 1
  );

-- Modes d'apprentissage, colonnes du plan de déroulement (section 2.2).
alter table public.suggestions_pedagogiques
  add column if not exists presentiel boolean not null default true,
  add column if not exists synchrone boolean not null default false,
  add column if not exists asynchrone boolean not null default false;

comment on table public.suggestions_pedagogiques is
  'Apprentissages de base du référentiel. Ce sont les « objectifs d''apprentissage » du manuel de formateur (A.1, A.2, B.1…), et l''unité de découpage d''un module en séances.';

-- Le programme étiquetait « B.3 » et « B.4 » deux apprentissages placés sous
-- l'élément C — réserve consignée lors de l'atome 1.3, sans correction
-- silencieuse faute de seconde source. Le manuel de formateur de la
-- compétence 6 les nomme C.3 et C.4 : l'ambiguïté est levée, on corrige.
update public.suggestions_pedagogiques sp
set code = 'C' || substring(sp.code from 2)
from public.elements_competence e
where e.id = sp.element_competence_id
  and e.lettre = 'C'
  and sp.code like 'B.%';
