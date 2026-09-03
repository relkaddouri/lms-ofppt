-- Gestion multi-année scolaire — le schéma (PRD §4.15).
--
-- Le produit n'avait aucune notion d'année scolaire : tout vivait dans une
-- seule base continue. Le formateur reconduit pourtant d'une année sur l'autre
-- l'essentiel de son organisation — seuls les stagiaires et leurs copies
-- changent réellement.
--
-- Portée minimale, avec un amendement. Tout ce qui pend d'un groupe hérite de
-- l'année par cette relation : annonces, contrôles, devoirs, stagiaires,
-- assignations, créneaux, et à travers `seance_groupes` les séances, fiches,
-- supports, présences et passations. Trois tables échappent à cette règle —
-- elles pendent du formateur et d'aucun groupe, tout en portant des dates :
-- `indisponibilites`, `rythmes_hebdomadaires` et `motifs_hebdomadaires`. Sans
-- portée explicite, changer d'année laisserait apparaître les absences et les
-- cibles horaires de l'année précédente. Elles reçoivent donc le champ aussi,
-- plutôt qu'une dérivation par intervalle de dates qui laisserait un motif à
-- cheval sur deux années ambigu.

create table if not exists public.annees_scolaires (
  id uuid primary key default gen_random_uuid(),
  formateur_id uuid not null default auth.uid()
    references public.profils(id) on delete cascade,
  libelle text not null,
  date_debut date not null,
  date_fin date not null,
  created_at timestamptz not null default now()
);

alter table public.annees_scolaires
  drop constraint if exists annees_scolaires_libelle_format;
alter table public.annees_scolaires
  add constraint annees_scolaires_libelle_format
  check (libelle ~ '^[0-9]{4}/[0-9]{4}$');

alter table public.annees_scolaires
  drop constraint if exists annees_scolaires_periode;
alter table public.annees_scolaires
  add constraint annees_scolaires_periode check (date_fin > date_debut);

create unique index if not exists annees_scolaires_unicite
  on public.annees_scolaires (formateur_id, libelle);

comment on table public.annees_scolaires is
  'Années scolaires d''un formateur. Les données d''une année passée ne sont '
  'jamais supprimées en changeant de sélection : elles restent consultables.';

alter table public.annees_scolaires enable row level security;

drop policy if exists annees_scolaires_proprietaire on public.annees_scolaires;
create policy annees_scolaires_proprietaire on public.annees_scolaires
  for all to authenticated
  using (formateur_id = auth.uid())
  with check (formateur_id = auth.uid());

-- ── L'année par défaut d'une écriture ─────────────────────────────────────
--
-- Sans elle, ajouter le champ casserait la création de groupe jusqu'à ce que
-- le sélecteur existe (§4.15.2). La plus récente par date de début fait un
-- repli juste : c'est celle dans laquelle on travaille tant qu'on n'en a pas
-- choisi une autre. Le sélecteur affinera « courante » en choix explicite.

create or replace function public.annee_scolaire_par_defaut()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.annees_scolaires
  where formateur_id = auth.uid()
  order by date_debut desc
  limit 1;
$$;

revoke execute on function public.annee_scolaire_par_defaut() from public, anon;
grant execute on function public.annee_scolaire_par_defaut() to authenticated;

-- ── Le champ, sur le groupe et sur les trois tables du formateur ──────────

alter table public.groupes
  add column if not exists annee_scolaire_id uuid
    references public.annees_scolaires(id) on delete set null;
alter table public.groupes
  alter column annee_scolaire_id set default public.annee_scolaire_par_defaut();

alter table public.indisponibilites
  add column if not exists annee_scolaire_id uuid
    references public.annees_scolaires(id) on delete set null;
alter table public.indisponibilites
  alter column annee_scolaire_id set default public.annee_scolaire_par_defaut();

alter table public.rythmes_hebdomadaires
  add column if not exists annee_scolaire_id uuid
    references public.annees_scolaires(id) on delete set null;
alter table public.rythmes_hebdomadaires
  alter column annee_scolaire_id set default public.annee_scolaire_par_defaut();

alter table public.motifs_hebdomadaires
  add column if not exists annee_scolaire_id uuid
    references public.annees_scolaires(id) on delete set null;
alter table public.motifs_hebdomadaires
  alter column annee_scolaire_id set default public.annee_scolaire_par_defaut();

create index if not exists groupes_annee_scolaire on public.groupes (annee_scolaire_id);
create index if not exists indisponibilites_annee_scolaire
  on public.indisponibilites (annee_scolaire_id);
create index if not exists rythmes_annee_scolaire
  on public.rythmes_hebdomadaires (annee_scolaire_id);
create index if not exists motifs_annee_scolaire
  on public.motifs_hebdomadaires (annee_scolaire_id);

comment on column public.groupes.annee_scolaire_id is
  'Année scolaire du groupe. Tout ce qui pend du groupe en hérite : il est le '
  'seul porteur de l''année pour les séances, contrôles, devoirs et annonces.';

-- ── Une séance ne se partage pas entre deux années ────────────────────────
--
-- Depuis la migration 052, une séance n'a plus de `groupe_id` : elle hérite de
-- son année par `seance_groupes`. Rien n'empêcherait donc de relier une séance
-- à deux groupes d'années différentes — une aberration qui rendrait l'année
-- d'une séance indéterminée, et la ferait apparaître dans les deux.

create or replace function public.verifie_annee_seance_groupe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_annee uuid;
  v_autre uuid;
begin
  select annee_scolaire_id into v_annee from public.groupes where id = new.groupe_id;

  select g.annee_scolaire_id into v_autre
  from public.seance_groupes sg
  join public.groupes g on g.id = sg.groupe_id
  where sg.seance_id = new.seance_id
    and sg.groupe_id <> new.groupe_id
    and g.annee_scolaire_id is distinct from v_annee
  limit 1;

  if found then
    raise exception
      'Une séance ne peut pas être partagée entre deux années scolaires différentes.';
  end if;

  return new;
end;
$$;

drop trigger if exists seance_groupes_meme_annee on public.seance_groupes;
create trigger seance_groupes_meme_annee
  before insert or update on public.seance_groupes
  for each row execute function public.verifie_annee_seance_groupe();
