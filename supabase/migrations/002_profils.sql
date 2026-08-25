create table if not exists public.profils (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'formateur' check (role in ('formateur', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profils enable row level security;

create policy "profils_select_own" on public.profils
  for select to authenticated using (auth.uid() = id);

create policy "profils_update_own" on public.profils
  for update to authenticated using (auth.uid() = id);
