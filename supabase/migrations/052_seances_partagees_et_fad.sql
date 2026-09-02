-- PRD §4.1bis — Formation à distance et séances partagées entre groupes.
--
-- Une séance présentielle reste propre à un groupe, mais une séance FAD de
-- tronc commun réunit DES101 et DES102 en une seule dispense. `groupe_id` ne
-- pouvait pas exprimer ça.
--
-- Choix : une vraie relation plusieurs-à-plusieurs, et `groupe_id` disparaît
-- dans la même migration. Garder les deux « le temps de migrer » aurait laissé
-- deux chemins de lecture — exactement le double-compte qu'on cherche à
-- éviter. Coût mesuré avant de trancher : les politiques passent d'un appel
-- de fonction sur colonne à un EXISTS sur la liaison, soit +25 à 30 % sur une
-- lecture de séances, dominés par l'appel de `peut_acceder_groupe` par ligne
-- qui existait déjà. À 2 000 séances : 17 ms → 23 ms.

create table if not exists public.seance_groupes (
  seance_id uuid not null references public.seances(id) on delete cascade,
  groupe_id uuid not null references public.groupes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (seance_id, groupe_id)
);

-- L'index inverse porte le sens le plus lu : « les séances de ce groupe ».
create index if not exists seance_groupes_groupe_idx
  on public.seance_groupes (groupe_id, seance_id);

insert into public.seance_groupes (seance_id, groupe_id)
select id, groupe_id from public.seances
where groupe_id is not null
on conflict do nothing;

-- ── Indicateur FAD et lien de visioconférence ─────────────────────────────

alter table public.seances
  add column if not exists est_fad boolean not null default false,
  add column if not exists lien_teams text;

comment on column public.seances.est_fad is
  'Séance dispensée à distance. Seule une séance FAD peut être partagée '
  'entre plusieurs groupes.';

-- `mode` disait déjà presentiel/distance mais n'était renseigné que sur 4
-- lignes sur 62, et ne portait ni lien ni partage. On l'aligne sur le nouvel
-- indicateur plutôt que de laisser deux sources de vérité.
update public.seances set est_fad = true where mode = 'distance';
alter table public.seances drop column if exists mode;

-- ── Décomposition de la masse horaire ─────────────────────────────────────

alter table public.groupe_modules
  add column if not exists heures_fad numeric not null default 0;

alter table public.groupe_modules
  drop constraint if exists groupe_modules_heures_fad_check;
alter table public.groupe_modules
  add constraint groupe_modules_heures_fad_check
  check (heures_fad >= 0 and heures_fad <= masse_horaire_allouee);

comment on column public.groupe_modules.heures_fad is
  'Part de la masse horaire dispensée à distance. Le présentiel se déduit '
  'par soustraction, il ne se ressaisit pas.';

-- ── Accès ─────────────────────────────────────────────────────────────────

alter table public.seance_groupes enable row level security;

drop policy if exists "seance_groupes_select" on public.seance_groupes;
create policy "seance_groupes_select" on public.seance_groupes
  for select to authenticated
  using (peut_acceder_groupe(groupe_id) or groupe_id = groupe_du_stagiaire());

drop policy if exists "seance_groupes_write" on public.seance_groupes;
create policy "seance_groupes_write" on public.seance_groupes
  for all to authenticated
  using (peut_acceder_groupe(groupe_id))
  with check (peut_acceder_groupe(groupe_id));

drop policy if exists "seances_select" on public.seances;
create policy "seances_select" on public.seances
  for select to authenticated
  using (
    exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = seances.id and peut_acceder_groupe(sg.groupe_id)
    )
  );

drop policy if exists "seances_write" on public.seances;
create policy "seances_write" on public.seances
  for all to authenticated
  using (
    exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = seances.id and peut_acceder_groupe(sg.groupe_id)
    )
  )
  with check (
    -- Une séance sans groupe n'existe pas encore : l'insertion pose la ligne,
    -- la liaison suit dans la même transaction côté application.
    not exists (select 1 from public.seance_groupes sg where sg.seance_id = seances.id)
    or exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = seances.id and peut_acceder_groupe(sg.groupe_id)
    )
  );

drop policy if exists "seances_lecture_stagiaire" on public.seances;
create policy "seances_lecture_stagiaire" on public.seances
  for select to authenticated
  using (
    exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = seances.id and sg.groupe_id = groupe_du_stagiaire()
    )
  );

-- ── Les tables rattachées à une séance ────────────────────────────────────
--
-- Cinq politiques d'autres tables passaient par `seances.groupe_id` pour
-- savoir à qui appartient une fiche, une présence, une remarque ou un
-- support. Elles suivent le même chemin que les séances : par la liaison.
-- Une fonction unique évite d'écrire cinq fois le même EXISTS.

create or replace function public.peut_acceder_seance(p_seance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seance_groupes sg
    where sg.seance_id = p_seance_id and peut_acceder_groupe(sg.groupe_id)
  );
$$;

revoke execute on function public.peut_acceder_seance(uuid) from public, anon;
grant execute on function public.peut_acceder_seance(uuid) to authenticated;

drop policy if exists "fiches_preparation_proprietaire" on public.fiches_preparation;
create policy "fiches_preparation_proprietaire" on public.fiches_preparation
  for all to authenticated
  using (peut_acceder_seance(seance_id))
  with check (peut_acceder_seance(seance_id));

drop policy if exists "presences_proprietaire" on public.presences;
create policy "presences_proprietaire" on public.presences
  for all to authenticated
  using (peut_acceder_seance(seance_id))
  with check (peut_acceder_seance(seance_id));

drop policy if exists "remarques_proprietaire" on public.remarques_seance;
create policy "remarques_proprietaire" on public.remarques_seance
  for all to authenticated
  using (peut_acceder_seance(seance_id))
  with check (peut_acceder_seance(seance_id));

drop policy if exists "supports_proprietaire" on public.supports_seance;
create policy "supports_proprietaire" on public.supports_seance
  for all to authenticated
  using (peut_acceder_seance(seance_id))
  with check (peut_acceder_seance(seance_id));

drop policy if exists "supports_lecture_stagiaire" on public.supports_seance;
create policy "supports_lecture_stagiaire" on public.supports_seance
  for select to authenticated
  using (
    exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = supports_seance.seance_id
        and sg.groupe_id = groupe_du_stagiaire()
    )
  );

-- ── La colonne disparaît ──────────────────────────────────────────────────

drop view if exists public.v_progression_module;
alter table public.seances drop column groupe_id;

-- ── Progression : deux compteurs, plus un total confondu ──────────────────
--
-- Une séance FAD partagée entre deux groupes crédite les deux — c'est voulu,
-- chaque groupe reçoit bien ces heures. Ce qui ne doit pas doubler, c'est la
-- charge du formateur : elle se calcule sur `seances`, pas sur cette vue.

create view public.v_progression_module
with (security_invoker = true)
as
select
  gm.groupe_id,
  gm.module_id,
  gm.masse_horaire_allouee,
  gm.heures_fad as heures_fad_prevues,
  (gm.masse_horaire_allouee - gm.heures_fad) as heures_presentiel_prevues,
  coalesce(sum(s.duree_realisee) filter (
    where s.statut = 'fait' and not s.est_fad), 0)::numeric
    as heures_presentiel_realisees,
  coalesce(sum(s.duree_realisee) filter (
    where s.statut = 'fait' and s.est_fad), 0)::numeric
    as heures_fad_realisees,
  coalesce(sum(s.duree_realisee) filter (where s.statut = 'fait'), 0)::numeric
    as heures_realisees,
  count(s.id) as nb_seances,
  count(s.id) filter (where s.statut = 'fait') as nb_seances_faites,
  count(s.id) filter (
    where s.statut = 'fait' and s.duree_realisee is null) as nb_seances_sans_duree
from public.groupe_modules gm
left join public.seance_groupes sg on sg.groupe_id = gm.groupe_id
left join public.seances s
       on s.id = sg.seance_id and s.module_id = gm.module_id
group by gm.groupe_id, gm.module_id, gm.masse_horaire_allouee, gm.heures_fad;
