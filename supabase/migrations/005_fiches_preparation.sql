create table if not exists public.fiches_preparation (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  contenu text,
  version integer not null default 1,
  statut text not null default 'brouillon',
  created_at timestamptz not null default now(),
  unique (module_id, version)
);

alter table public.fiches_preparation enable row level security;

drop policy if exists "fiches_preparation_read_auth" on public.fiches_preparation;
drop policy if exists "fiches_preparation_write_auth" on public.fiches_preparation;
create policy "fiches_preparation_read_auth" on public.fiches_preparation
  for select to authenticated using (true);
create policy "fiches_preparation_write_auth" on public.fiches_preparation
  for all to authenticated using (true) with check (true);
