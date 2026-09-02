-- Journal d'audit : portée réelle, et fermeture de deux trous.
--
-- 1. Le journal ne traçait que les contrôles validés, alors que l'écran
--    annonce « les modifications portées aux fiches, contrôles et notes ».
--    Les fiches de préparation et les copies corrigées y entrent désormais —
--    la correction d'une copie étant devenue modifiable, la tracer n'est plus
--    optionnel.
--
-- 2. `audit_log` s'ouvrait à tout compte authentifié, en lecture (`using
--    (true)` : un formateur voyait l'activité de tous les autres) comme en
--    écriture (n'importe qui pouvait fabriquer une entrée dans un journal
--    présenté comme non modifiable). La lecture est ramenée à ce que le
--    formateur peut atteindre, l'insertion passe par les seuls déclencheurs.

-- ── Portée ────────────────────────────────────────────────────────────────

create or replace function public.log_fiche_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (table_name, ligne_id, action, ancienne_valeur, nouvelle_valeur, utilisateur)
  values (
    'fiches_preparation',
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;

drop trigger if exists trg_fiches_audit on public.fiches_preparation;
create trigger trg_fiches_audit
after insert or update or delete on public.fiches_preparation
for each row execute function public.log_fiche_changes();

create or replace function public.log_passation_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seule la correction se trace : la remise elle-même est déjà datée par
  -- `submitted_at`, et n'est le fait de personne d'autre que le stagiaire.
  if tg_op = 'UPDATE' and (old.note is distinct from new.note
                           or old.responses is distinct from new.responses) then
    insert into public.audit_log (table_name, ligne_id, action, ancienne_valeur, nouvelle_valeur, utilisateur)
    values ('passations_controle', new.id, tg_op, to_jsonb(old), to_jsonb(new), auth.uid());
  end if;
  return null;
end;
$$;

drop trigger if exists trg_passations_audit on public.passations_controle;
create trigger trg_passations_audit
after update on public.passations_controle
for each row execute function public.log_passation_changes();

-- ── Accès ─────────────────────────────────────────────────────────────────

create or replace function public.peut_acceder_audit(
  p_table text,
  p_ligne uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_table
    when 'controles' then peut_acceder_controle(p_ligne)
    when 'passations_controle' then exists (
      select 1 from passations_controle p
      where p.id = p_ligne and peut_acceder_controle(p.controle_id)
    )
    when 'fiches_preparation' then exists (
      select 1 from fiches_preparation f
      join seances s on s.id = f.seance_id
      where f.id = p_ligne and peut_acceder_groupe(s.groupe_id)
    )
    else false
  end;
$$;

revoke execute on function public.peut_acceder_audit(text, uuid) from public, anon;
grant execute on function public.peut_acceder_audit(text, uuid) to authenticated;

drop policy if exists "audit_log_select_auth" on public.audit_log;
drop policy if exists "audit_log_insert_auth" on public.audit_log;
drop policy if exists "audit_log_select" on public.audit_log;

-- Ses propres écritures, plus celles portant sur ce qu'il peut atteindre :
-- un co-formateur voit ce qui touche à son groupe, jamais le reste.
create policy "audit_log_select" on public.audit_log
  for select to authenticated
  using (utilisateur = auth.uid() or peut_acceder_audit(table_name, ligne_id));

-- Pas de politique d'insertion : les déclencheurs sont `security definer`,
-- rien d'autre n'a à écrire ici.
