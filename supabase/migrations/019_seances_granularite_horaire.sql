-- 019_seances_granularite_horaire.sql — Atome 2.1
--
-- Une séance n'est pas un événement journalier rattaché à un module : elle a
-- des heures précises, et la journée d'un formateur peut enchaîner plusieurs
-- séances sur des modules différents (PRD §4.10). C'est cette granularité qui
-- alimente la fiche de préparation, le cumul d'heures et le seuil de contrôle.

alter table public.seances
  add column if not exists heure_debut time,
  add column if not exists heure_fin time,
  add column if not exists mode text,
  add column if not exists objectif_operationnel text,
  add column if not exists duree_realisee numeric,
  add column if not exists a_prevoir_prochaine_seance text;

alter table public.seances drop constraint if exists seances_mode_check;
alter table public.seances
  add constraint seances_mode_check
  check (mode is null or mode in ('presentiel', 'distance'));

alter table public.seances drop constraint if exists seances_horaires_check;
alter table public.seances
  add constraint seances_horaires_check
  check (heure_debut is null or heure_fin is null or heure_fin > heure_debut);

alter table public.seances drop constraint if exists seances_duree_realisee_check;
alter table public.seances
  add constraint seances_duree_realisee_check
  check (duree_realisee is null or duree_realisee >= 0);

create index if not exists seances_groupe_module_date_idx
  on public.seances (groupe_id, module_id, date);

comment on column public.seances.heure_debut is
  'Heure de debut reelle. La duree exacte de la seance alimente la fiche de '
  'preparation et le cumul d heures, pas une duree de module generique.';
comment on column public.seances.mode is
  'presentiel ou distance : le deroule pedagogique en depend.';
comment on column public.seances.objectif_operationnel is
  'Objectif vise, saisi en amont (colonne Prevision du cahier du formateur).';
comment on column public.seances.duree_realisee is
  'Heures effectivement dispensees. Peut differer de l ecart heure_fin - '
  'heure_debut ; c est cette valeur qui compte pour le cumul.';
comment on column public.seances.a_prevoir_prochaine_seance is
  'Champ de transition vers la seance suivante.';
