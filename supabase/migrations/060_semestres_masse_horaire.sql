-- Masse horaire par semestre (PRD §4.13bis, corrigé sur exemplaire réel).
--
-- Le tableau de service officiel ne porte pas une valeur par couple
-- groupe+module mais quatre : présentiel S1, FAD S1, présentiel S2, FAD S2.
-- Un module peut se donner entièrement sur un semestre (M106 : rien en S1,
-- tout en S2) ou se répartir sur les deux (M205 : 55+15 puis 40+10).
--
-- `masse_horaire_allouee` et `heures_fad` deviennent des colonnes générées sur
-- ces quatre valeurs. C'est ce qui rend le changement léger : les quatorze
-- lectures existantes — progression, répartition, rappels, manuel, page
-- Modules, écran d'assignation — continuent de fonctionner sans être
-- touchées, comme `code_operationnel` en migration 051. Seules les deux
-- écritures changent.

-- ── 1. Les quatre valeurs ─────────────────────────────────────────────────

alter table public.groupe_modules
  add column if not exists presentiel_s1 numeric not null default 0,
  add column if not exists fad_s1 numeric not null default 0,
  add column if not exists presentiel_s2 numeric not null default 0,
  add column if not exists fad_s2 numeric not null default 0;

-- ── 2. Reprise : tout en S1 par défaut ────────────────────────────────────
--
-- Valeur de départ neutre et réversible. La répartition réelle par semestre
-- vient juste après, ligne par ligne, et se vérifie contre ce qui est déjà en
-- base — voir l'étape 5.

update public.groupe_modules
set presentiel_s1 = masse_horaire_allouee - heures_fad,
    fad_s1 = heures_fad
where presentiel_s1 = 0 and fad_s1 = 0 and presentiel_s2 = 0 and fad_s2 = 0;

-- ── 3. FAD mutualisée ─────────────────────────────────────────────────────
--
-- Sur le document officiel, la part à distance d'un module de tronc commun
-- partagé entre deux groupes n'est portée que par une seule des deux lignes —
-- les cellules de l'autre sont laissées vides. C'est cohérent avec §4.1bis :
-- chaque groupe est bien crédité de ces heures pour sa progression, mais le
-- formateur ne les dispense qu'une fois et sa charge ne les compte qu'une
-- fois.
--
-- Le drapeau ne retire donc rien à la masse horaire du groupe : il ne fait
-- qu'écarter ces heures du tableau de service. Un seul modèle rend les deux
-- totaux — 960 h de progression cumulée, 920 h de charge réelle.

alter table public.groupe_modules
  add column if not exists fad_mutualisee boolean not null default false;

comment on column public.groupe_modules.fad_mutualisee is
  'Vrai quand la part à distance de ce couple est dispensée conjointement '
  'avec un autre groupe : le groupe en est crédité pour sa progression, mais '
  'le tableau de service du formateur ne la compte pas une seconde fois.';

-- ── 4. Les deux anciennes colonnes deviennent générées ────────────────────
--
-- Une colonne existante ne se convertit pas sur place : il faut la supprimer
-- et la recréer. La vue qui en dépend tombe avec, elle est reconstruite à
-- l'identique juste après.

drop view if exists public.v_progression_module;

alter table public.groupe_modules
  drop constraint if exists groupe_modules_heures_fad_check,
  drop constraint if exists groupe_modules_masse_horaire_check;

alter table public.groupe_modules
  drop column masse_horaire_allouee,
  drop column heures_fad;

alter table public.groupe_modules
  add column masse_horaire_allouee numeric
    generated always as (presentiel_s1 + fad_s1 + presentiel_s2 + fad_s2) stored,
  add column heures_fad numeric
    generated always as (fad_s1 + fad_s2) stored;

comment on column public.groupe_modules.masse_horaire_allouee is
  'Total des quatre valeurs semestrielles. Calculée : elle ne se saisit plus.';
comment on column public.groupe_modules.heures_fad is
  'Part à distance des deux semestres. Calculée : elle ne se saisit plus.';

alter table public.groupe_modules
  add constraint groupe_modules_heures_positives
  check (presentiel_s1 >= 0 and fad_s1 >= 0 and presentiel_s2 >= 0 and fad_s2 >= 0);

create view public.v_progression_module
with (security_invoker = true)
as
select
  gm.groupe_id,
  gm.module_id,
  gm.masse_horaire_allouee,
  gm.heures_fad as heures_fad_prevues,
  (gm.masse_horaire_allouee - gm.heures_fad) as heures_presentiel_prevues,
  coalesce(sum(s.duree_realisee) filter (
    where s.statut = 'fait' and not s.est_fad), 0)::numeric
    as heures_presentiel_realisees,
  coalesce(sum(s.duree_realisee) filter (
    where s.statut = 'fait' and s.est_fad), 0)::numeric
    as heures_fad_realisees,
  coalesce(sum(s.duree_realisee) filter (where s.statut = 'fait'), 0)::numeric
    as heures_realisees,
  count(s.id) as nb_seances,
  count(s.id) filter (where s.statut = 'fait') as nb_seances_faites,
  count(s.id) filter (
    where s.statut = 'fait' and s.duree_realisee is null) as nb_seances_sans_duree
from public.groupe_modules gm
left join public.seance_groupes sg on sg.groupe_id = gm.groupe_id
left join public.seances s
       on s.id = sg.seance_id and s.module_id = gm.module_id
group by gm.groupe_id, gm.module_id, gm.masse_horaire_allouee, gm.heures_fad;
