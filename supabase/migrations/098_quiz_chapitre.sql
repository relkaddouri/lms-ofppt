-- 098_quiz_chapitre.sql — le quiz d'auto-évaluation d'un chapitre (PRD §4.5bis)
--
-- Chaque chapitre se termine par quelques questions tirées de son propre
-- support. Ce n'est pas une évaluation : rien n'est noté, rien ne remonte au
-- formateur, et le stagiaire le rejoue autant qu'il veut. C'est un outil de
-- révision — répondre soi-même est ce qui fixe une notion.
--
-- Le quiz est écrit une fois par l'IA, puis conservé : le régénérer à chaque
-- ouverture coûterait un appel par lecture et donnerait à deux stagiaires du
-- même groupe deux quiz différents pour un même cours.

create table if not exists public.quiz_chapitre (
  support_id uuid primary key references public.supports_seance (id) on delete cascade,
  questions jsonb not null,
  modele text,
  genere_le timestamptz not null default now()
);

comment on table public.quiz_chapitre is
  'Quiz d''auto-évaluation d''un chapitre, écrit depuis son support. Non noté, rejouable, jamais remonté au formateur.';

alter table public.quiz_chapitre enable row level security;

-- Lecture : ceux qui ont accès au chapitre — les stagiaires du groupe à qui le
-- support est destiné, et le formateur de la séance.
drop policy if exists "quiz_chapitre_lecture" on public.quiz_chapitre;
create policy "quiz_chapitre_lecture" on public.quiz_chapitre
  for select to authenticated
  using (
    exists (
      select 1 from public.supports_seance s
       where s.id = quiz_chapitre.support_id
         and (
           public.peut_acceder_seance(s.seance_id)
           or (
             s.destinataire = 'stagiaire'
             and exists (
               select 1 from public.seance_groupes sg
                where sg.seance_id = s.seance_id
                  and sg.groupe_id = public.groupe_du_stagiaire()
             )
           )
         )
    )
  );

-- Écriture : le formateur de la séance. La génération passe par la route, qui
-- écrit avec la clé de service après avoir vérifié l'accès — un stagiaire ne
-- fabrique pas son propre quiz.
drop policy if exists "quiz_chapitre_formateur" on public.quiz_chapitre;
create policy "quiz_chapitre_formateur" on public.quiz_chapitre
  for all to authenticated
  using (
    exists (
      select 1 from public.supports_seance s
       where s.id = quiz_chapitre.support_id
         and public.peut_acceder_seance(s.seance_id)
    )
  )
  with check (
    exists (
      select 1 from public.supports_seance s
       where s.id = quiz_chapitre.support_id
         and public.peut_acceder_seance(s.seance_id)
    )
  );
