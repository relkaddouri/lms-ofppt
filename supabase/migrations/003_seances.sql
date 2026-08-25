create table if not exists public.seances (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.groupes(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  date date,
  contenu_prevu text,
  contenu_realise text,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'fait')),
  created_at timestamptz not null default now()
);

alter table public.seances enable row level security;

drop policy if exists "seances_read_auth" on public.seances;
drop policy if exists "seances_write_auth" on public.seances;
create policy "seances_read_auth" on public.seances
  for select to authenticated using (true);
create policy "seances_write_auth" on public.seances
  for all to authenticated using (true) with check (true);
