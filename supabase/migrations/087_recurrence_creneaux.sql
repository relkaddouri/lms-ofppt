-- L'alternance des créneaux de l'emploi du temps (PRD §4.9).
--
-- Un créneau revenait chaque semaine, sans exception. Or un formateur accélère
-- parfois un groupe en alternant : 25 heures une semaine, 27 h 30 la suivante
-- — un créneau de 2 h 30 qui ne revient qu'une semaine sur deux. D'autres ne
-- reviennent qu'une fois par mois. Les déclarer comme hebdomadaires plaçait
-- deux fois trop de séances ; ne pas les déclarer n'en plaçait aucune.
--
-- Trois rythmes :
--
--   - `hebdomadaire` : chaque semaine, comme avant ;
--   - `une_semaine_sur_deux` : la semaine de `premiere_date`, puis toutes les
--     deux semaines — dans les deux sens, pour qu'un créneau déclaré en
--     novembre sache aussi quelles semaines d'octobre étaient les siennes ;
--   - `mensuelle` : le même rang du jour dans le mois que `premiere_date` —
--     déclarée un premier mardi, elle revient chaque premier mardi. Un mois
--     sans cinquième mardi n'a pas de séance pour un créneau déclaré un
--     cinquième mardi : c'est ce que « une fois par mois » veut dire quand on
--     l'ancre sur ce jour-là.
--
-- Les créneaux existants restent hebdomadaires : rien ne bouge au déploiement.

alter table public.creneaux_motif
  add column if not exists recurrence text not null default 'hebdomadaire',
  add column if not exists premiere_date date;

alter table public.creneaux_motif
  drop constraint if exists creneau_recurrence_connue;
alter table public.creneaux_motif
  add constraint creneau_recurrence_connue
  check (recurrence in ('hebdomadaire', 'une_semaine_sur_deux', 'mensuelle'));

-- Un rythme alterné sans point de départ ne dit pas quelles semaines sont les
-- siennes ; un point de départ qui ne tombe pas le bon jour ne le dit pas non
-- plus.
alter table public.creneaux_motif
  drop constraint if exists creneau_premiere_date_coherente;
alter table public.creneaux_motif
  add constraint creneau_premiere_date_coherente
  check (
    recurrence = 'hebdomadaire'
    or (
      premiere_date is not null
      and extract(isodow from premiere_date) = jour_semaine
    )
  );

comment on column public.creneaux_motif.recurrence is
  'hebdomadaire, une_semaine_sur_deux (à partir de premiere_date, toutes les deux semaines) ou mensuelle (le même rang du jour dans le mois que premiere_date).';
comment on column public.creneaux_motif.premiere_date is
  'Première occurrence d''un créneau alterné : elle fixe ses semaines. Nulle pour un créneau hebdomadaire.';
