-- Des questions qui tiennent debout (PRD §4.7bis, backlog 10.2).
--
-- Deux défauts d'un sujet de CC généré pour M202 :
--
--   1. deux exercices renvoyaient à un « corpus fourni en annexe » qui
--      n'existait nulle part — ni dans le PDF, ni à l'écran de passation ;
--   2. une question reprenait mot pour mot une note d'organisation du
--      formateur, écrite dans le « contenu réalisé » d'une séance.
--
-- Deux ajouts en base, un par défaut.

-- ── Les données d'une question ─────────────────────────────────────────────
--
-- Le matériau sur lequel le stagiaire travaille — observations, tableau,
-- extrait de corpus —, séparé de l'énoncé qui dit quoi en faire. Il fait
-- partie de la question : le stagiaire le lit à l'écran pendant la passation
-- en ligne, il s'imprime dans le sujet, et le correcteur le reçoit. En
-- Markdown, pour les tableaux.
alter table public.questions_controle
  add column if not exists donnees text;

alter table public.questions_controle
  drop constraint if exists questions_controle_donnees_longueur;
alter table public.questions_controle
  add constraint questions_controle_donnees_longueur
  check (donnees is null or length(donnees) <= 20000);

comment on column public.questions_controle.donnees is
  'Matériau de la question (observations, tableau, extrait), en Markdown. Montré au stagiaire avec l''énoncé ; jamais une référence à une pièce absente.';

-- Le sujet servi au stagiaire pendant la passation gagne les données. Le type
-- de retour change : la fonction se recrée plutôt que de se remplacer.
drop function if exists public.get_sujet_pour_passation(uuid);
create function public.get_sujet_pour_passation(p_controle_id uuid)
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
    and c.groupe_id = public.groupe_du_stagiaire()
  order by q."position";
$$;

grant execute on function public.get_sujet_pour_passation(uuid) to authenticated;

-- ── Les notes du formateur sur une séance ──────────────────────────────────
--
-- Une table à part, et non une colonne de `seances` : la policy
-- `seances_lecture_stagiaire` ouvre la ligne entière d'une séance au groupe.
-- Une colonne « notes pour moi » y aurait été lisible de tout stagiaire qui
-- interroge l'API. Ici, seul qui gère le groupe lit et écrit.
--
-- Ces notes ne partent jamais vers un modèle de langage : aucun générateur ne
-- lit cette table.
create table if not exists public.notes_seance (
  seance_id uuid primary key references public.seances (id) on delete cascade,
  texte text not null default '' check (length(texte) <= 20000),
  updated_at timestamptz not null default now()
);

comment on table public.notes_seance is
  'Notes privées du formateur sur une séance : organisation, rattrapage, rappel. Jamais montrées aux stagiaires, jamais envoyées à un modèle.';

alter table public.notes_seance enable row level security;

drop policy if exists "notes_seance_formateur" on public.notes_seance;
create policy "notes_seance_formateur" on public.notes_seance
  for all to authenticated
  using (
    exists (
      select 1 from public.seance_groupes sg
       where sg.seance_id = notes_seance.seance_id
         and public.peut_acceder_groupe(sg.groupe_id)
    )
  )
  with check (
    exists (
      select 1 from public.seance_groupes sg
       where sg.seance_id = notes_seance.seance_id
         and public.peut_acceder_groupe(sg.groupe_id)
    )
  );
