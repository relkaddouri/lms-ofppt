-- 101_tentatives_quiz.sql — ce que les quiz d'auto-évaluation apprennent au
-- formateur (demande du 25 septembre 2026)
--
-- La 11.3 n'enregistrait rien, pour qu'un stagiaire ose se tromper. Le
-- porteur de projet demande l'inverse : voir qui s'entraîne, sur quoi, et ce
-- qui ne rentre pas. Les tentatives sont donc conservées — mais elles ne
-- changent rien à ce que le stagiaire voit : le quiz reste non noté, hors
-- moyenne, rejouable autant de fois qu'il veut.
--
-- Elles ne remontent qu'au formateur du groupe. Aucune politique ne les rend
-- lisibles au stagiaire ni à ses camarades : ce n'est pas un classement, et
-- une erreur d'entraînement n'a rien à faire sous les yeux des autres.

create table if not exists public.tentatives_quiz (
  id uuid primary key default gen_random_uuid(),
  stagiaire_id uuid not null references public.stagiaires (id) on delete cascade,
  genre text not null check (genre in ('chapitre', 'bilan')),
  -- Un quiz de chapitre porte son support ; un bilan, son module et son rang.
  support_id uuid references public.supports_seance (id) on delete cascade,
  module_id uuid references public.modules (id) on delete cascade,
  rang integer,
  justes integer not null check (justes >= 0),
  questions integer not null check (questions > 0),
  -- [{ question, bonne, choisie, juste }] : ce qui permet de dire quelle
  -- notion manque, et pas seulement combien de points manquent.
  reponses jsonb not null,
  secondes integer check (secondes is null or secondes >= 0),
  created_at timestamptz not null default now(),
  constraint tentatives_quiz_cible check (
    (genre = 'chapitre' and support_id is not null)
    or (genre = 'bilan' and module_id is not null and rang is not null)
  )
);

comment on table public.tentatives_quiz is
  'Tentatives de quiz d''auto-évaluation et de bilan. Non notées, rejouables ; lues par le formateur du groupe, jamais par les stagiaires.';

create index if not exists tentatives_quiz_stagiaire_idx
  on public.tentatives_quiz (stagiaire_id, created_at desc);
create index if not exists tentatives_quiz_support_idx
  on public.tentatives_quiz (support_id);

alter table public.tentatives_quiz enable row level security;

-- Écriture : le stagiaire, pour lui-même et pour personne d'autre.
drop policy if exists "tentatives_quiz_ecriture" on public.tentatives_quiz;
create policy "tentatives_quiz_ecriture" on public.tentatives_quiz
  for insert to authenticated
  with check (
    stagiaire_id in (
      select s.id from public.stagiaires s where s.user_id = auth.uid()
    )
  );

-- Lecture : le formateur du groupe du stagiaire.
drop policy if exists "tentatives_quiz_formateur" on public.tentatives_quiz;
create policy "tentatives_quiz_formateur" on public.tentatives_quiz
  for select to authenticated
  using (
    exists (
      select 1
      from public.stagiaires s
      join public.groupes g on g.id = s.groupe_id
      where s.id = tentatives_quiz.stagiaire_id
        and g.formateur_id = auth.uid()
    )
  );

-- La progression de lecture s'ouvre au formateur, en lecture seule.
--
-- La 097 la réservait au stagiaire. Le suivi demandé le 25/09/2026 a besoin
-- de savoir quels chapitres ont été lus : sans cela, « il n'a passé aucun
-- quiz » ne se distingue pas de « il n'a pas encore ouvert le cours ».
-- L'écriture, elle, reste au seul stagiaire : le formateur ne coche rien à sa
-- place.
drop policy if exists "progression_chapitre_formateur" on public.progression_chapitre;
create policy "progression_chapitre_formateur" on public.progression_chapitre
  for select to authenticated
  using (
    exists (
      select 1
      from public.stagiaires s
      join public.groupes g on g.id = s.groupe_id
      where s.id = progression_chapitre.stagiaire_id
        and g.formateur_id = auth.uid()
    )
  );
