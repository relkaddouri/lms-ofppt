create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  ligne_id uuid,
  action text not null,
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb,
  utilisateur uuid,
  date timestamptz not null default now()
);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select_auth" on public.audit_log;
drop policy if exists "audit_log_insert_auth" on public.audit_log;
create policy "audit_log_select_auth" on public.audit_log
  for select to authenticated using (true);
create policy "audit_log_insert_auth" on public.audit_log
  for insert to authenticated with check (true);

create or replace function public.log_controle_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE' and old.statut = 'valide')
     or (tg_op <> 'DELETE' and new.statut = 'valide') then
    insert into public.audit_log (table_name, ligne_id, action, ancienne_valeur, nouvelle_valeur, utilisateur)
    values (
      'controles',
      coalesce(new.id, old.id),
      tg_op,
      case when tg_op = 'DELETE' then null else to_jsonb(old) end,
      case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end,
      auth.uid()
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_controles_audit on public.controles;
create trigger trg_controles_audit
after insert or update or delete on public.controles
for each row execute function public.log_controle_changes();
