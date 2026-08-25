create table if not exists public.controles (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  titre text,
  consignes text,
  duree_heures numeric not null default 1,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'valide')),
  created_at timestamptz not null default now()
);

create table if not exists public.questions_controle (
  id uuid primary key default gen_random_uuid(),
  controle_id uuid not null references public.controles(id) on delete cascade,
  enonce text,
  bareme numeric not null default 0,
  corrige text,
  position integer not null default 0
);

alter table public.controles enable row level security;
alter table public.questions_controle enable row level security;

drop policy if exists "controles_read_auth" on public.controles;
drop policy if exists "controles_write_auth" on public.controles;
create policy "controles_read_auth" on public.controles
  for select to authenticated using (true);
create policy "controles_write_auth" on public.controles
  for all to authenticated using (true) with check (true);

drop policy if exists "questions_controle_read_auth" on public.questions_controle;
drop policy if exists "questions_controle_write_auth" on public.questions_controle;
create policy "questions_controle_read_auth" on public.questions_controle
  for select to authenticated using (true);
create policy "questions_controle_write_auth" on public.questions_controle
  for all to authenticated using (true) with check (true);
