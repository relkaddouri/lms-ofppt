-- 039 — Le fil : réactions et commentaires sur les annonces.
--
-- Une annonce était un texte que le formateur publiait et que personne ne
-- pouvait ni saluer ni discuter. Le PRD en fait un fil : « j'aime » et
-- commentaires sont les deux actions principales, atteignables en un geste.
--
-- Auteur d'un commentaire : le compte, pas le nom. Deux stagiaires homonymes se
-- confondraient, et un nom recopié ne prouve rien.

create table if not exists public.reactions_annonce (
  annonce_id uuid not null references public.annonces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Une réaction par personne et par annonce : « j'aime » se donne ou se
  -- retire, il ne se cumule pas.
  primary key (annonce_id, user_id)
);

comment on table public.reactions_annonce is
  'Réactions « j''aime » sur une annonce. Une par personne.';

create table if not exists public.commentaires_annonce (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces (id) on delete cascade,
  auteur_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  texte text not null check (length(trim(texte)) > 0 and length(texte) <= 2000),
  created_at timestamptz not null default now()
);

comment on table public.commentaires_annonce is
  'Commentaires d''un fil. Les mentions sont écrites @Prénom Nom dans le texte et résolues à l''affichage.';

create index if not exists commentaires_annonce_idx
  on public.commentaires_annonce (annonce_id, created_at);
create index if not exists reactions_annonce_idx
  on public.reactions_annonce (annonce_id);

alter table public.reactions_annonce enable row level security;
alter table public.commentaires_annonce enable row level security;

-- ---------------------------------------------------------------------------
-- Une annonce est accessible à qui accède à son groupe : le formateur
-- propriétaire, ou le stagiaire du groupe. La condition est écrite une fois.
-- ---------------------------------------------------------------------------
create or replace function public.peut_acceder_annonce(p_annonce_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.annonces a
    where a.id = p_annonce_id
      and (
        public.peut_acceder_groupe(a.groupe_id)
        or a.groupe_id = public.groupe_du_stagiaire()
      )
  );
$$;

grant execute on function public.peut_acceder_annonce(uuid) to authenticated;

create policy "reactions_lecture" on public.reactions_annonce
  for select to authenticated
  using (public.peut_acceder_annonce(annonce_id));

-- On ne réagit que pour soi : le user_id inséré doit être le sien.
create policy "reactions_ecriture" on public.reactions_annonce
  for insert to authenticated
  with check (user_id = auth.uid() and public.peut_acceder_annonce(annonce_id));

create policy "reactions_retrait" on public.reactions_annonce
  for delete to authenticated
  using (user_id = auth.uid());

create policy "commentaires_lecture" on public.commentaires_annonce
  for select to authenticated
  using (public.peut_acceder_annonce(annonce_id));

create policy "commentaires_ecriture" on public.commentaires_annonce
  for insert to authenticated
  with check (auteur_id = auth.uid() and public.peut_acceder_annonce(annonce_id));

-- Chacun retire ses propres mots ; le formateur peut modérer son groupe.
create policy "commentaires_suppression" on public.commentaires_annonce
  for delete to authenticated
  using (
    auteur_id = auth.uid()
    or exists (
      select 1 from public.annonces a
      where a.id = commentaires_annonce.annonce_id
        and public.peut_acceder_groupe(a.groupe_id)
    )
  );
