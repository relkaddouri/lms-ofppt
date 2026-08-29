-- 047 — Jours où l'on n'enseigne pas.
--
-- Trois besoins que le PRD énonce séparément — fériés et vacances OFPPT,
-- emploi du temps personnel, arrêt maladie — mais qui répondent tous à la même
-- question devant le calendrier : « ce créneau est-il disponible ? ». Une
-- table unique avec un type, plutôt que trois tables jumelles et trois
-- policies à maintenir.
--
-- Le calendrier officiel de l'OFPPT n'est pas publié sous forme exploitable :
-- la saisie est manuelle, comme le demande l'atome.

create table if not exists public.indisponibilites (
  id uuid primary key default gen_random_uuid(),
  formateur_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  type text not null check (type in ('ferie', 'vacances', 'absence', 'personnel')),
  date_debut date not null,
  date_fin date not null,
  -- Un rendez-vous prend une matinée, pas une journée : sans cette colonne il
  -- faudrait bloquer le jour entier et se mentir sur sa disponibilité.
  demi_journee text check (demi_journee is null or demi_journee in ('matin', 'soir')),
  libelle text,
  -- Un motif ne se justifie que pour une absence ; ailleurs le libellé suffit.
  motif text,
  created_at timestamptz not null default now(),

  constraint indisponibilites_periode_check check (date_fin >= date_debut),
  -- Une demi-journée ne peut concerner qu'un seul jour : « les matins du
  -- 3 au 12 » ne veut rien dire dans une grille hebdomadaire.
  -- Nom explicite : Postgres réserve déjà `indisponibilites_demi_journee_check`
  -- au contrôle de valeur posé sur la colonne elle-même.
  constraint indisponibilites_demi_journee_un_seul_jour
    check (demi_journee is null or date_debut = date_fin)
);

comment on table public.indisponibilites is
  'Jours et demi-journées non travaillés : fériés, vacances, absences, engagements personnels du formateur.';

create index if not exists indisponibilites_periode_idx
  on public.indisponibilites (formateur_id, date_debut, date_fin);

alter table public.indisponibilites enable row level security;

-- Chacun ne voit et ne gère que son propre calendrier.
create policy "indisponibilites_proprietaire" on public.indisponibilites
  for all to authenticated
  using (formateur_id = auth.uid())
  with check (formateur_id = auth.uid());
