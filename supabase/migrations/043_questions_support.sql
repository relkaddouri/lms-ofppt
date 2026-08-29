-- 043 — Questions des stagiaires sur un support de cours.
--
-- Un stagiaire qui relit un cours bute sur un point précis. Il pose sa
-- question là où elle se pose — sur le support — plutôt que dans le fil
-- général où elle se perdrait entre deux annonces.
--
-- Ces questions valent au-delà de la promotion qui les a posées : les mêmes
-- points bloquent d'une année sur l'autre. La table est donc une archive
-- pluriannuelle et non un fil jetable — d'où le contexte figé (module, année
-- scolaire, titre du support) recopié à l'écriture : la séance et le support
-- peuvent disparaître, la question reste lisible.
--
-- Aucune réutilisation automatique n'est prévue pour l'instant : rien ne
-- ressort ces questions dans une génération. C'est un choix, pas un oubli.

-- ---------------------------------------------------------------------------
-- Année scolaire d'une date : septembre ouvre l'année suivante.
-- ---------------------------------------------------------------------------
create or replace function public.annee_scolaire(p_date date)
returns text
language sql
immutable
as $$
  select case
    when extract(month from coalesce(p_date, current_date)) >= 9
      then extract(year from coalesce(p_date, current_date))::int || '-' ||
           (extract(year from coalesce(p_date, current_date))::int + 1)
    else (extract(year from coalesce(p_date, current_date))::int - 1) || '-' ||
         extract(year from coalesce(p_date, current_date))::int
  end;
$$;

comment on function public.annee_scolaire(date) is
  'Année scolaire au format 2025-2026. Septembre ouvre l''année suivante.';

create table if not exists public.questions_support (
  id uuid primary key default gen_random_uuid(),
  -- Le lien vers le support se coupe si la séance est supprimée ; la question
  -- lui survit grâce au contexte recopié ci-dessous.
  support_id uuid references public.supports_seance (id) on delete set null,
  module_id uuid not null references public.modules (id) on delete cascade,
  groupe_id uuid references public.groupes (id) on delete set null,
  -- Propriétaire de l'archive : le formateur garde ses questions même quand le
  -- groupe qui les a posées n'existe plus.
  formateur_id uuid not null references auth.users (id) on delete cascade,
  annee_scolaire text not null,
  support_titre text not null,
  auteur_id uuid not null references auth.users (id) on delete cascade,
  texte text not null check (length(trim(texte)) > 0 and length(texte) <= 2000),
  created_at timestamptz not null default now()
);

comment on table public.questions_support is
  'Questions posées sur un support de cours. Archive pluriannuelle : le contexte est figé à l''écriture. Les mentions sont écrites @Prénom Nom dans le texte et résolues à l''affichage.';

create table if not exists public.reponses_question (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null
    references public.questions_support (id) on delete cascade,
  auteur_id uuid not null references auth.users (id) on delete cascade,
  texte text not null check (length(trim(texte)) > 0 and length(texte) <= 2000),
  created_at timestamptz not null default now()
);

comment on table public.reponses_question is
  'Réponses à une question de support, du formateur comme d''un camarade.';

create index if not exists questions_support_idx
  on public.questions_support (support_id, created_at);
create index if not exists questions_support_archive_idx
  on public.questions_support (formateur_id, module_id, annee_scolaire);
create index if not exists reponses_question_idx
  on public.reponses_question (question_id, created_at);

alter table public.questions_support enable row level security;
alter table public.reponses_question enable row level security;

-- ---------------------------------------------------------------------------
-- Qui voit une question : son formateur, à toute époque, et les stagiaires du
-- groupe qui l'a posée. Un stagiaire ne voit pas les promotions précédentes.
-- ---------------------------------------------------------------------------
create or replace function public.peut_acceder_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.questions_support q
    where q.id = p_question_id
      and (
        q.formateur_id = auth.uid()
        or (q.groupe_id is not null and q.groupe_id = public.groupe_du_stagiaire())
      )
  );
$$;

grant execute on function public.peut_acceder_question(uuid) to authenticated;

create policy "questions_support_lecture" on public.questions_support
  for select to authenticated
  using (
    formateur_id = auth.uid()
    or (groupe_id is not null and groupe_id = public.groupe_du_stagiaire())
  );

-- Chacun retire ses propres mots ; le formateur modère son archive.
create policy "questions_support_suppression" on public.questions_support
  for delete to authenticated
  using (auteur_id = auth.uid() or formateur_id = auth.uid());

create policy "reponses_question_lecture" on public.reponses_question
  for select to authenticated
  using (public.peut_acceder_question(question_id));

create policy "reponses_question_suppression" on public.reponses_question
  for delete to authenticated
  using (
    auteur_id = auth.uid()
    or exists (
      select 1 from public.questions_support q
      where q.id = reponses_question.question_id and q.formateur_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- L'écriture passe par une fonction : le contexte archivé est dérivé du
-- support, jamais reçu du client. Un stagiaire pourrait sinon rattacher sa
-- question au module de son choix.
-- ---------------------------------------------------------------------------
create or replace function public.poser_question_support(
  p_support_id uuid,
  p_texte text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seance record;
  v_id uuid;
begin
  select s.id as seance_id, s.module_id, s.groupe_id, s.date,
         g.formateur_id, g.date_debut,
         coalesce(sup.contenu ->> 'titre', m.nom) as titre
    into v_seance
    from public.supports_seance sup
    join public.seances s on s.id = sup.seance_id
    join public.groupes g on g.id = s.groupe_id
    join public.modules m on m.id = s.module_id
   where sup.id = p_support_id;

  if v_seance is null then
    raise exception 'Support introuvable.';
  end if;

  if not (
    v_seance.groupe_id = public.groupe_du_stagiaire()
    or public.peut_acceder_groupe(v_seance.groupe_id)
  ) then
    raise exception 'Accès refusé à ce support.';
  end if;

  insert into public.questions_support (
    support_id, module_id, groupe_id, formateur_id,
    annee_scolaire, support_titre, auteur_id, texte
  )
  values (
    p_support_id, v_seance.module_id, v_seance.groupe_id, v_seance.formateur_id,
    public.annee_scolaire(coalesce(v_seance.date, v_seance.date_debut)),
    v_seance.titre, auth.uid(), p_texte
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.poser_question_support(uuid, text) to authenticated;

create or replace function public.repondre_question(
  p_question_id uuid,
  p_texte text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.peut_acceder_question(p_question_id) then
    raise exception 'Accès refusé à cette question.';
  end if;

  insert into public.reponses_question (question_id, auteur_id, texte)
  values (p_question_id, auth.uid(), p_texte)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.repondre_question(uuid, text) to authenticated;
