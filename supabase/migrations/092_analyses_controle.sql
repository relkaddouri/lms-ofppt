-- 092_analyses_controle.sql — Atome 10.6 (PRD §4.7bis)
--
-- L'analyse de compréhension d'un contrôle : ce que la classe a compris ou
-- non, d'après ses réponses réelles.
--
-- Une analyse est enregistrée, et chacune reste : on relance après une
-- nouvelle vague de copies ou une correction revue, et l'on compare. Le
-- contenu est une photographie JSON — statistiques calculées, lecture du
-- modèle — pour qu'une analyse ancienne se relise telle qu'elle a été faite,
-- même si les copies ont changé depuis.
--
-- Jamais lue par un stagiaire : la seule politique ouvre la table au
-- formateur du contrôle. Les noms n'y entrent que dans `pseudonymes`, la
-- correspondance « Stagiaire A → nom » que le serveur garde pour l'écran du
-- formateur ; le modèle, lui, n'a reçu que les pseudonymes.

create table if not exists public.analyses_controle (
  id uuid primary key default gen_random_uuid(),
  controle_id uuid not null references public.controles (id) on delete cascade,
  created_at timestamptz not null default now(),
  nb_copies integer not null check (nb_copies >= 0),
  statistiques jsonb not null,
  lecture jsonb not null,
  pseudonymes jsonb not null default '{}'::jsonb,
  modele text
);

comment on table public.analyses_controle is
  'Analyses de compréhension d''un contrôle (statistiques et lecture du modèle). Formateur seulement ; le modèle ne reçoit jamais les noms.';

create index if not exists analyses_controle_controle_idx
  on public.analyses_controle (controle_id, created_at desc);

alter table public.analyses_controle enable row level security;

drop policy if exists "analyses_controle_formateur" on public.analyses_controle;
create policy "analyses_controle_formateur" on public.analyses_controle
  for all to authenticated
  using (public.peut_acceder_controle(controle_id))
  with check (public.peut_acceder_controle(controle_id));
