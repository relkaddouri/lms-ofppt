create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.groupes(id) on delete cascade,
  titre text not null,
  contenu text,
  date date,
  created_at timestamptz not null default now()
);

alter table public.annonces enable row level security;

drop policy if exists "annonces_read_auth" on public.annonces;
drop policy if exists "annonces_write_auth" on public.annonces;
create policy "annonces_read_auth" on public.annonces
  for select to authenticated using (true);
create policy "annonces_write_auth" on public.annonces
  for all to authenticated using (true) with check (true);

create or replace function public.get_annonces_by_token(p_token uuid)
returns setof public.annonces
language sql security definer
as $$
  select a.*
  from public.annonces a
  join public.groupes g on g.id = a.groupe_id
  where g.token_public = p_token;
$$;

create or replace function public.get_seances_by_groupe_token(p_token uuid)
returns table (
  id uuid,
  groupe_id uuid,
  module_id uuid,
  module_nom text,
  date date,
  contenu_prevu text,
  contenu_realise text,
  statut text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql security definer
as $$
  select s.id, s.groupe_id, s.module_id, m.nom as module_nom, s.date,
         s.contenu_prevu, s.contenu_realise, s.statut, s.created_at, s.updated_at
  from public.seances s
  join public.groupes g on g.id = s.groupe_id
  left join public.modules m on m.id = s.module_id
  where g.token_public = p_token;
$$;

revoke all on function public.get_annonces_by_token(uuid) from public;
revoke all on function public.get_seances_by_groupe_token(uuid) from public;
grant execute on function public.get_annonces_by_token(uuid) to anon;
grant execute on function public.get_seances_by_groupe_token(uuid) to anon;
grant execute on function public.get_annonces_by_token(uuid) to authenticated;
grant execute on function public.get_seances_by_groupe_token(uuid) to authenticated;
