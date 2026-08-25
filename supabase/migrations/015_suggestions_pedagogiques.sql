-- 015_suggestions_pedagogiques.sql — Atome 1.3
--
-- Suggestions pédagogiques officielles, rattachées à un élément de compétence :
-- apprentissages de base, éléments de contenu, activités d'apprentissage et
-- durée suggérée (PRD §4.2).
--
-- Le référentiel fusionne certaines cellules : la durée suggérée et les
-- activités d'apprentissage ne sont portées que par le premier apprentissage
-- de chaque élément. Elles sont donc nullables, et une durée renseignée vaut
-- pour l'élément entier — la somme des durées d'une compétence fait 100 %.

create table if not exists public.suggestions_pedagogiques (
  id uuid primary key default gen_random_uuid(),
  element_competence_id uuid not null
    references public.elements_competence(id) on delete cascade,
  code text,
  apprentissage_base text not null,
  elements_contenu text,
  activites_apprentissage text,
  duree_suggeree_pourcent numeric
    check (duree_suggeree_pourcent is null
           or (duree_suggeree_pourcent >= 0 and duree_suggeree_pourcent <= 100)),
  ordre integer not null check (ordre >= 1),
  created_at timestamptz not null default now(),
  unique (element_competence_id, ordre)
);

comment on table public.suggestions_pedagogiques is
  'Suggestions pedagogiques officielles rattachees a un element de competence.';
comment on column public.suggestions_pedagogiques.code is
  'Libelle du referentiel pour cet apprentissage, ex. A.1. Conserve tel quel.';
comment on column public.suggestions_pedagogiques.elements_contenu is
  'Elements de contenu, une ligne par item.';
comment on column public.suggestions_pedagogiques.activites_apprentissage is
  'Activites d apprentissage. Null quand le referentiel les fusionne au niveau '
  'de l element : elles sont alors portees par le premier apprentissage.';
comment on column public.suggestions_pedagogiques.duree_suggeree_pourcent is
  'Pourcentage de la duree de la competence. Renseigne une seule fois par '
  'element ; la somme sur une competence vaut 100 %.';


alter table public.suggestions_pedagogiques enable row level security;

drop policy if exists "suggestions_pedagogiques_select" on public.suggestions_pedagogiques;

create policy "suggestions_pedagogiques_select" on public.suggestions_pedagogiques
  for select to authenticated using (auth.uid() is not null);
