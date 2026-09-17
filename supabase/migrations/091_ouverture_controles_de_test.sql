-- 091_ouverture_controles_de_test.sql — Atome 10.5 (PRD §4.7bis)
--
-- La passation d'un contrôle de test : le formateur l'ouvre au groupe, puis
-- le ferme.
--
-- Deux dates plutôt qu'un interrupteur. `ouvert_le` dit qu'il a été ouvert,
-- et depuis quand ; `ferme_le` dit jusqu'à quand. Un test chronométré est un
-- test ouvert avec une fermeture déjà fixée — il se ferme seul, sans tâche
-- planifiée, parce que « ouvert » se lit en comparant à l'heure. Fermer à la
-- main, c'est poser `ferme_le` à maintenant.
--
-- Une fois ouvert, un test reste visible au stagiaire, même fermé : il doit
-- retrouver sa copie rendue, puis son résultat quand il sera publié. Seule la
-- composition exige qu'il soit ouvert.

alter table public.controles
  add column if not exists ouvert_le timestamptz,
  add column if not exists ferme_le timestamptz;

alter table public.controles drop constraint if exists controles_ouverture_test;
alter table public.controles
  add constraint controles_ouverture_test check (
    (ouvert_le is null and ferme_le is null)
    or (type = 'TEST' and ouvert_le is not null)
  );

comment on column public.controles.ouvert_le is
  'Contrôle de test : moment où le formateur l''a ouvert au groupe. Null tant qu''il ne l''a jamais été.';
comment on column public.controles.ferme_le is
  'Contrôle de test : fin de la passation — fixée d''avance pour un test chronométré, posée à la fermeture sinon. Null : ouvert sans limite.';

/** Vrai si le contrôle se compose en ce moment. */
create or replace function public.controle_ouvert(c public.controles)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when c.type <> 'TEST' then true
    else c.ouvert_le is not null
         and c.ouvert_le <= now()
         and (c.ferme_le is null or c.ferme_le > now())
  end;
$$;

-- ── Lecture par le stagiaire ──────────────────────────────────────────────
drop policy if exists "controles_lecture_stagiaire" on public.controles;
create policy "controles_lecture_stagiaire" on public.controles
  for select to authenticated
  using (
    groupe_id = public.groupe_du_stagiaire()
    and statut = 'valide'
    and (type <> 'TEST' or ouvert_le is not null)
  );

-- ── Le sujet : seulement pendant l'ouverture ──────────────────────────────
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
    and public.controle_ouvert(c)
    and c.groupe_id = public.groupe_du_stagiaire()
  order by q."position";
$$;
