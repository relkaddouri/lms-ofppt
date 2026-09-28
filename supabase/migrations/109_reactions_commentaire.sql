-- « J'aime » sur un commentaire, et plus seulement sur l'annonce.
--
-- Le fil vit dans les commentaires : une félicitation en appelle une autre, et
-- jusqu'ici la seule façon d'y répondre était d'écrire à son tour. Un fil de
-- quinze « Félicitation » n'apprend rien à personne.
--
-- Même forme que `reactions_annonce` (migration 039), et pour les mêmes
-- raisons : le compte et non le nom — deux stagiaires homonymes se
-- confondraient —, et une réaction par personne, qui se donne ou se retire
-- mais ne se cumule pas.
create table if not exists public.reactions_commentaire (
  commentaire_id uuid not null
    references public.commentaires_annonce (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (commentaire_id, user_id)
);

comment on table public.reactions_commentaire is
  'Réactions « j''aime » sur un commentaire de fil. Une par personne.';

create index if not exists reactions_commentaire_idx
  on public.reactions_commentaire (commentaire_id);

alter table public.reactions_commentaire enable row level security;

-- Qui accède au commentaire accède à sa réaction : la condition existe déjà
-- pour l'annonce qui le porte, on la réutilise plutôt que d'en écrire une
-- seconde qui divergerait.
create or replace function public.peut_acceder_commentaire(p_commentaire_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.commentaires_annonce c
    where c.id = p_commentaire_id
      and public.peut_acceder_annonce(c.annonce_id)
  );
$$;

grant execute on function public.peut_acceder_commentaire(uuid) to authenticated;

create policy "reactions_commentaire_lecture" on public.reactions_commentaire
  for select to authenticated
  using (public.peut_acceder_commentaire(commentaire_id));

-- On ne réagit que pour soi : le user_id inséré doit être le sien.
create policy "reactions_commentaire_ecriture" on public.reactions_commentaire
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.peut_acceder_commentaire(commentaire_id)
  );

create policy "reactions_commentaire_retrait" on public.reactions_commentaire
  for delete to authenticated
  using (user_id = auth.uid());
