-- `peut_acceder_audit` passait encore par `seances.groupe_id`, supprimé par la
-- migration 052 : le journal d'audit tombait en erreur. Une fonction en base
-- n'est pas typée par le client, rien ne l'avait signalé.

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
      where f.id = p_ligne and peut_acceder_seance(f.seance_id)
    )
    else false
  end;
$$;
