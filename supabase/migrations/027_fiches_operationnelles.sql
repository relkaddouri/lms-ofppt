-- 027 — La fiche de préparation se rattache à une séance, plus à un module.
--
-- (L'atome 2.4 nomme cette migration 015 ; ce numéro est déjà pris par
-- 015_suggestions_pedagogiques.sql. Le contenu est celui demandé.)
--
-- Une fiche de préparation prépare une séance précise : sa durée, son objectif
-- opérationnel, ce qui a été fait la fois d'avant. Rattachée au module, elle ne
-- pouvait être qu'un document unique et générique, réécrit de version en
-- version, sans lien avec le déroulé réel d'un groupe.
--
-- L'ancienne table est conservée sous un autre nom : elle contient le travail
-- déjà saisi, qu'aucune règle ne permet de rattacher automatiquement à une
-- séance. C'est au formateur de reprendre ce contenu s'il le souhaite.

alter table if exists public.fiches_preparation
  rename to fiches_prescrites_legacy;

comment on table public.fiches_prescrites_legacy is
  'Ancienne fiche de préparation rattachée au module. Conservée pour reprise manuelle du contenu ; à supprimer une fois la Phase 1 validée.';

-- Les policies suivent la table renommée : on les remplace par une lecture
-- restreinte au propriétaire du module, au lieu du `using (true)` d'origine.
drop policy if exists "fiches_preparation_read_auth" on public.fiches_prescrites_legacy;
drop policy if exists "fiches_preparation_write_auth" on public.fiches_prescrites_legacy;

create policy "legacy_lecture_proprietaire" on public.fiches_prescrites_legacy
  for select to authenticated
  using (public.peut_acceder_module(module_id));

create table public.fiches_preparation (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances (id) on delete cascade,
  contenu text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  -- L'atome demande une référence unique vers la séance. L'unicité porte sur
  -- le couple séance + version : une séance n'a qu'une fiche, mais son
  -- historique de révisions reste consultable, comme c'était déjà le cas.
  unique (seance_id, version)
);

comment on table public.fiches_preparation is
  'Fiche de préparation d''une séance. Une séance, une fiche, historisée par version.';

create index if not exists fiches_preparation_seance_idx
  on public.fiches_preparation (seance_id, version desc);

alter table public.fiches_preparation enable row level security;

-- Une fiche appartient au formateur du groupe dont relève la séance : on
-- réutilise le pivot existant plutôt que d'écrire une quatrième règle de
-- propriété qui divergerait des trois autres.
create policy "fiches_preparation_proprietaire" on public.fiches_preparation
  for all to authenticated
  using (
    public.peut_acceder_groupe(
      (select s.groupe_id from public.seances s where s.id = seance_id)
    )
  )
  with check (
    public.peut_acceder_groupe(
      (select s.groupe_id from public.seances s where s.id = seance_id)
    )
  );
