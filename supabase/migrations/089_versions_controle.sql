-- 089_versions_controle.sql — Atome 10.3 (PRD §4.7bis)
--
-- Les versions successives d'un contrôle en préparation.
--
-- Chaque enregistrement fige une photographie complète du contrôle — en-tête
-- et questions — dans `contenu`. Une photographie plutôt qu'un journal de
-- différences : revenir à une version, c'est recharger un objet entier dans
-- l'éditeur, sans rejouer une suite de modifications dont une seule manquante
-- corromprait tout le reste.
--
-- `questions_controle` reste la version courante, celle que lisent la
-- passation, la correction et les PDF : rien de ce qui existe ne change de
-- source.

create table if not exists public.versions_controle (
  id uuid primary key default gen_random_uuid(),
  controle_id uuid not null references public.controles (id) on delete cascade,
  numero integer not null check (numero >= 1),
  -- Ce qui a produit la version : un enregistrement ordinaire, un retour à
  -- une version antérieure, une duplication.
  origine text not null default 'enregistrement'
    check (origine in ('enregistrement', 'restauration', 'duplication')),
  -- La version d'où l'on est reparti, pour une restauration ou une variante.
  source_numero integer,
  contenu jsonb not null,
  nb_questions integer not null default 0,
  total_bareme numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (controle_id, numero)
);

comment on table public.versions_controle is
  'Photographies successives d''un contrôle (en-tête et questions). La version courante reste dans controles et questions_controle.';

create index if not exists versions_controle_controle_idx
  on public.versions_controle (controle_id, numero desc);

alter table public.versions_controle enable row level security;

-- Le formateur du module seulement : une version contient le corrigé.
drop policy if exists "versions_controle_formateur" on public.versions_controle;
create policy "versions_controle_formateur" on public.versions_controle
  for all to authenticated
  using (public.peut_acceder_controle(controle_id))
  with check (public.peut_acceder_controle(controle_id));

-- La variante d'un contrôle : d'où elle vient.
alter table public.controles
  add column if not exists duplique_de uuid references public.controles (id) on delete set null;

-- ── Version 1 des contrôles existants ─────────────────────────────────────
--
-- Sans elle, le premier enregistrement après la mise en service écraserait
-- l'état actuel sans qu'on puisse y revenir.
insert into public.versions_controle
  (controle_id, numero, origine, contenu, nb_questions, total_bareme, created_at)
select
  c.id,
  1,
  'enregistrement',
  jsonb_build_object(
    'titre', c.titre,
    'consignes', c.consignes,
    'duree_heures', c.duree_heures,
    'type', c.type,
    'type_efm', c.type_efm,
    'format', c.format,
    'date_prevue', c.date_prevue,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', q.type,
        'enonce', q.enonce,
        'donnees', q.donnees,
        'bareme', q.bareme,
        'options', q.options,
        'corrige', q.corrige,
        'difficulte', q.difficulte,
        'justification_bareme', q.justification_bareme
      ) order by q.position)
      from public.questions_controle q where q.controle_id = c.id
    ), '[]'::jsonb)
  ),
  (select count(*) from public.questions_controle q where q.controle_id = c.id),
  coalesce((select sum(q.bareme) from public.questions_controle q where q.controle_id = c.id), 0),
  c.created_at
from public.controles c
where not exists (
  select 1 from public.versions_controle v where v.controle_id = c.id
);
