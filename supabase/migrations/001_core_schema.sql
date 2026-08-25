-- modules
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text,
  duree_heures integer not null default 0,
  created_at timestamptz not null default now()
);

-- groupes
create table if not exists public.groupes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  date_debut date,
  date_fin date,
  created_at timestamptz not null default now()
);

alter table public.groupes add column if not exists token_public uuid default gen_random_uuid();

-- groupe_modules (liaison plusieurs-à-plusieurs)
create table if not exists public.groupe_modules (
  groupe_id uuid not null references public.groupes(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  primary key (groupe_id, module_id),
  created_at timestamptz not null default now()
);

-- stagiaires
create table if not exists public.stagiaires (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  email text,
  groupe_id uuid references public.groupes(id),
  created_at timestamptz not null default now()
);

-- RLS
alter table public.modules enable row level security;
alter table public.groupes enable row level security;
alter table public.groupe_modules enable row level security;
alter table public.stagiaires enable row level security;

-- Policies : lecture/écriture pour utilisateurs authentifiés
drop policy if exists "modules_read_auth" on public.modules;
drop policy if exists "modules_write_auth" on public.modules;
create policy "modules_read_auth" on public.modules
  for select to authenticated using (true);
create policy "modules_write_auth" on public.modules
  for all to authenticated using (true) with check (true);

drop policy if exists "groupes_read_auth" on public.groupes;
drop policy if exists "groupes_write_auth" on public.groupes;
create policy "groupes_read_auth" on public.groupes
  for select to authenticated using (true);
create policy "groupes_write_auth" on public.groupes
  for all to authenticated using (true) with check (true);

drop policy if exists "groupe_modules_read_auth" on public.groupe_modules;
drop policy if exists "groupe_modules_write_auth" on public.groupe_modules;
create policy "groupe_modules_read_auth" on public.groupe_modules
  for select to authenticated using (true);
create policy "groupe_modules_write_auth" on public.groupe_modules
  for all to authenticated using (true) with check (true);

drop policy if exists "stagiaires_read_auth" on public.stagiaires;
drop policy if exists "stagiaires_write_auth" on public.stagiaires;
create policy "stagiaires_read_auth" on public.stagiaires
  for select to authenticated using (true);
create policy "stagiaires_write_auth" on public.stagiaires
  for all to authenticated using (true) with check (true);

-- Lecture publique via token (fonction security definer pour les pages publiques)
create or replace function public.get_groupe_by_token(p_token uuid)
returns setof public.groupes
language sql security definer
as $$
  select * from public.groupes where token_public = p_token;
$$;

revoke all on function public.get_groupe_by_token(uuid) from public;
grant execute on function public.get_groupe_by_token(uuid) to anon;
grant execute on function public.get_groupe_by_token(uuid) to authenticated;
