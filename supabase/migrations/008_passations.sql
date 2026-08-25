alter table public.controles add column if not exists token_public uuid default gen_random_uuid();

create table if not exists public.passations_controle (
  id uuid primary key default gen_random_uuid(),
  controle_id uuid not null references public.controles(id) on delete cascade,
  nom_complet text not null,
  email text,
  note numeric,
  responses jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.passations_controle enable row level security;

create policy "passations_insert_anon" on public.passations_controle
  for insert to anon with check (true);
create policy "passations_select_auth" on public.passations_controle
  for select to authenticated using (true);
create policy "passations_insert_auth" on public.passations_controle
  for insert to authenticated with check (true);

create or replace function public.get_controle_by_token(p_token uuid)
returns setof public.controles
language sql security definer
as $$
  select * from public.controles where token_public = p_token;
$$;

create or replace function public.get_questions_by_controle_token(p_token uuid)
returns table (
  id uuid,
  controle_id uuid,
  enonce text,
  bareme numeric,
  corrige text,
  "position" integer
)
language sql security definer
as $$
  select q.id, q.controle_id, q.enonce, q.bareme, q.corrige, q."position"
  from public.questions_controle q
  join public.controles c on c.id = q.controle_id
  where c.token_public = p_token
  order by q."position";
$$;

revoke all on function public.get_controle_by_token(uuid) from public;
revoke all on function public.get_questions_by_controle_token(uuid) from public;
grant execute on function public.get_controle_by_token(uuid) to anon;
grant execute on function public.get_questions_by_controle_token(uuid) to anon;
grant execute on function public.get_controle_by_token(uuid) to authenticated;
grant execute on function public.get_questions_by_controle_token(uuid) to authenticated;
