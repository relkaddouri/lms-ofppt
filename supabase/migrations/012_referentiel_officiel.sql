-- 012_referentiel_officiel.sql — Atome 1.1
--
-- Fondation du référentiel officiel OFPPT : Spécialité → Programme → Compétence.
-- Ce référentiel est saisi une fois par spécialité et réutilisé chaque année
-- (PRD §3) : il ne contient aucune donnée appartenant à un formateur précis,
-- d'où une lecture ouverte à tout utilisateur authentifié.


create table if not exists public.specialites (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  code text not null unique,
  duree_totale_heures integer,
  created_at timestamptz not null default now()
);

comment on table public.specialites is
  'Spécialité de formation (ex. Digital Design — Option UX Designer).';
comment on column public.specialites.duree_totale_heures is
  'Durée totale du programme national (ex. 1435h pour UX Designer).';


create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  specialite_id uuid not null references public.specialites(id) on delete cascade,
  annee_approbation integer,
  created_at timestamptz not null default now(),
  unique (specialite_id, annee_approbation)
);

comment on table public.programmes is
  'Programme de formation d''une spécialité, versionné par année d''approbation.';


create table if not exists public.competences (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  numero integer not null check (numero >= 1),
  code_officiel text not null,
  code_operationnel text,
  nom text not null,
  duree_nationale_heures integer,
  competences_prealables text,
  competences_paralleles text,
  created_at timestamptz not null default now(),
  -- Contrainte centrale : deux compétences d'un même programme ne peuvent pas
  -- porter le même numéro d'ordre.
  unique (programme_id, numero),
  unique (programme_id, code_officiel)
);

comment on table public.competences is
  'Compétence du programme — appelée « module » dans la terminologie officielle OFPPT.';
comment on column public.competences.numero is
  'Numéro d''ordre dans le programme (1 à 16 pour UX Designer). Non plafonné : '
  'une autre spécialité peut en compter un nombre différent (PRD §3).';
comment on column public.competences.code_officiel is
  'Code du référentiel national, ex. DIA_DESOUX_TS-06.';
comment on column public.competences.code_operationnel is
  'Code court du quotidien, ex. M106. Nullable : certains modules transversaux '
  '(ex. EGTSI106) ne suivent pas le motif M1XX.';
comment on column public.competences.duree_nationale_heures is
  'Durée de référence nationale. La masse horaire réellement allouée est portée '
  'par le couple groupe+module, pas ici (PRD §4.1).';
comment on column public.competences.competences_prealables is
  'Compétences préalables, en texte libre pour l''instant.';
comment on column public.competences.competences_paralleles is
  'Compétences pouvant être menées en parallèle, en texte libre pour l''instant.';


-- ============================================================================
-- RLS : lecture pour tout utilisateur authentifié
-- ============================================================================
-- Référentiel national partagé : aucune notion de propriétaire ici, contrairement
-- aux tables métier de la migration 011. Les écritures passent par le serveur
-- (service_role), conformément à l'import relu avant validation de l'atome 1.4.

alter table public.specialites enable row level security;
alter table public.programmes enable row level security;
alter table public.competences enable row level security;

drop policy if exists "specialites_select" on public.specialites;
drop policy if exists "programmes_select" on public.programmes;
drop policy if exists "competences_select" on public.competences;

create policy "specialites_select" on public.specialites
  for select to authenticated using (auth.uid() is not null);
create policy "programmes_select" on public.programmes
  for select to authenticated using (auth.uid() is not null);
create policy "competences_select" on public.competences
  for select to authenticated using (auth.uid() is not null);
