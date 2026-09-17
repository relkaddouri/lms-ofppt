-- 090_controles_de_test.sql — Atome 10.4 (PRD §4.7bis)
--
-- Les contrôles de test : des évaluations formatives, à côté des CC et des EFM
-- réglementaires. Un troisième type plutôt qu'un drapeau posé sur un CC : un
-- test n'est pas un contrôle continu, et tout ce qui compte les CC — code
-- d'épreuve CC1, CC2, échéances, moyenne — doit pouvoir l'écarter en lisant
-- son type, sans avoir à se souvenir d'une seconde colonne.

-- ── Le type ───────────────────────────────────────────────────────────────
alter table public.controles drop constraint if exists controles_type_check;
alter table public.controles
  add constraint controles_type_check check (type in ('CC', 'EFM', 'TEST'));

alter table public.controles drop constraint if exists controles_efm_qualifie;
alter table public.controles
  add constraint controles_efm_qualifie check (
    (type = 'EFM' and type_efm is not null)
    or (type in ('CC', 'TEST') and type_efm is null)
  );

comment on column public.controles.type is
  'CC : contrôle continu (20 pts). EFM : épreuve de fin de module (40 pts). TEST : contrôle de test formatif — hors minimum réglementaire, hors échéances, hors moyenne ; barème libre (bareme_total).';

-- ── Le barème libre d'un test ─────────────────────────────────────────────
alter table public.controles
  add column if not exists bareme_total numeric;

alter table public.controles drop constraint if exists controles_bareme_total;
alter table public.controles
  add constraint controles_bareme_total check (
    bareme_total is null or (bareme_total > 0 and bareme_total <= 200)
  );

comment on column public.controles.bareme_total is
  'Total visé d''un contrôle de test (20 par défaut). Ignoré pour un CC (20) et un EFM (40), dont le total est réglementaire.';

-- ── Le périmètre : les séances évaluées ───────────────────────────────────
--
-- Retenu pour tous les types, et indispensable pour un test, qui porte sur des
-- séances choisies une à une : l'analyse de compréhension (10.6) rapporte les
-- erreurs aux séances où les notions ont été traitées.
alter table public.controles
  add column if not exists seance_ids uuid[];

comment on column public.controles.seance_ids is
  'Séances retenues à l''étape « Contenu couvert » ; null pour un contrôle antérieur à la migration 090.';

-- ── Pas encore de passation d'un test ─────────────────────────────────────
--
-- L'ouverture et la fermeture d'un test au groupe arrivent avec l'atome 10.5.
-- D'ici là, un test validé ne doit ni apparaître au stagiaire ni pouvoir être
-- composé : la lecture et le sujet l'écartent explicitement.
drop policy if exists "controles_lecture_stagiaire" on public.controles;
create policy "controles_lecture_stagiaire" on public.controles
  for select to authenticated
  using (
    groupe_id = public.groupe_du_stagiaire()
    and statut = 'valide'
    and type <> 'TEST'
  );

create or replace function public.get_sujet_pour_passation(p_controle_id uuid)
returns table (
  id uuid,
  type text,
  enonce text,
  donnees text,
  bareme numeric,
  options jsonb,
  "position" integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.type,
    q.enonce,
    q.donnees,
    q.bareme,
    -- Le drapeau « correcte » ne sort jamais : c'est le corrigé du QCM.
    case
      when q.type = 'qcm' and q.options is not null then (
        select jsonb_agg(jsonb_build_object('texte', o ->> 'texte') order by n)
        from jsonb_array_elements(q.options) with ordinality as t(o, n)
      )
      else null
    end as options,
    q."position"
  from public.questions_controle q
  join public.controles c on c.id = q.controle_id
  where c.id = p_controle_id
    and c.statut = 'valide'
    and c.type <> 'TEST'
    and c.groupe_id = public.groupe_du_stagiaire()
  order by q."position";
$$;

-- ── La note maximale d'une copie ──────────────────────────────────────────
create or replace function public.corriger_passation(
  p_passation_id uuid,
  p_responses jsonb,
  p_note numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_controle_id uuid;
  v_total numeric;
begin
  select controle_id into v_controle_id
  from passations_controle
  where id = p_passation_id;

  if v_controle_id is null then
    raise exception 'Copie introuvable.';
  end if;

  if not peut_acceder_controle(v_controle_id) then
    raise exception 'Vous ne corrigez pas ce contrôle.';
  end if;

  select coalesce(sum(bareme), 0) into v_total
  from questions_controle
  where controle_id = v_controle_id;

  -- Un contrôle sans question barémée ne borne rien : on retombe sur le total
  -- attendu de son type plutôt que de refuser toute note.
  if v_total <= 0 then
    select case
             when type = 'EFM' then 40
             when type = 'TEST' then coalesce(bareme_total, 20)
             else 20
           end into v_total
    from controles where id = v_controle_id;
  end if;

  if p_note < 0 or p_note > v_total then
    raise exception 'La note doit être comprise entre 0 et %.', v_total;
  end if;

  update passations_controle
     set responses = p_responses,
         note = p_note
   where id = p_passation_id;
end;
$$;

revoke execute on function corriger_passation(uuid, jsonb, numeric) from public, anon;
grant execute on function corriger_passation(uuid, jsonb, numeric) to authenticated;
