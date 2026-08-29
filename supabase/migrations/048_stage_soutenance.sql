-- 048 — Stage et soutenance (compétence 16).
--
-- Dernière compétence du parcours : le stagiaire part en entreprise, rend un
-- rapport et le soutient devant un jury. Trois choses à tenir — le suivi
-- administratif, les pièces justificatives, les deux notes — qui vivent toutes
-- autour d'un même objet : le stage d'un stagiaire.
--
-- Les sous-notes sont stockées séparément et jamais leur somme : un total
-- recopié se désynchronise au premier ajustement. Le barème officiel borne
-- chaque case, la base refuse une note hors barème.

create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  stagiaire_id uuid not null unique
    references public.stagiaires (id) on delete cascade,

  entreprise text,
  tuteur_nom text,
  tuteur_contact text,
  date_debut date,
  date_fin date,

  -- Rapport /20 : présentation /8 + contenu /12.
  note_rapport_presentation numeric(4, 2)
    check (note_rapport_presentation is null
           or (note_rapport_presentation >= 0 and note_rapport_presentation <= 8)),
  note_rapport_contenu numeric(4, 2)
    check (note_rapport_contenu is null
           or (note_rapport_contenu >= 0 and note_rapport_contenu <= 12)),

  -- Exposé /20 : fond /14 + forme /6.
  note_expose_fond numeric(4, 2)
    check (note_expose_fond is null
           or (note_expose_fond >= 0 and note_expose_fond <= 14)),
  note_expose_forme numeric(4, 2)
    check (note_expose_forme is null
           or (note_expose_forme >= 0 and note_expose_forme <= 6)),

  -- Un nom de juré par ligne : même idiome que les listes du reste du projet.
  jury text,
  date_soutenance date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stages_periode_check
    check (date_debut is null or date_fin is null or date_fin >= date_debut)
);

comment on table public.stages is
  'Stage et soutenance d''un stagiaire (compétence 16). Les sous-notes sont stockées séparément, jamais leur somme.';

create table if not exists public.documents_stage (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages (id) on delete cascade,
  type text not null check (type in ('contrat', 'attestation', 'note_tuteur')),
  -- Chemin dans le bucket, pas une URL : une URL signée expire, le chemin non.
  chemin text not null,
  nom_fichier text not null,
  taille_octets bigint,
  created_at timestamptz not null default now(),

  -- Une pièce par nature : déposer un second contrat remplace le premier.
  unique (stage_id, type)
);

comment on table public.documents_stage is
  'Pièces justificatives d''un stage. Le fichier vit dans le bucket documents-stage ; cette table en tient le registre.';

create index if not exists documents_stage_idx on public.documents_stage (stage_id);

alter table public.stages enable row level security;
alter table public.documents_stage enable row level security;

-- ---------------------------------------------------------------------------
-- Un stage est accessible à qui accède au groupe de son stagiaire.
-- Écrit une fois, réutilisé par les policies des deux tables et du bucket.
-- ---------------------------------------------------------------------------
create or replace function public.peut_acceder_stage(p_stage_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stages st
    join public.stagiaires s on s.id = st.stagiaire_id
    where st.id = p_stage_id
      and public.peut_acceder_groupe(s.groupe_id)
  );
$$;

revoke execute on function public.peut_acceder_stage(uuid) from public, anon;
grant execute on function public.peut_acceder_stage(uuid) to authenticated;

create policy "stages_proprietaire" on public.stages
  for all to authenticated
  using (
    exists (
      select 1 from public.stagiaires s
      where s.id = stages.stagiaire_id
        and public.peut_acceder_groupe(s.groupe_id)
    )
  )
  with check (
    exists (
      select 1 from public.stagiaires s
      where s.id = stages.stagiaire_id
        and public.peut_acceder_groupe(s.groupe_id)
    )
  );

create policy "documents_stage_proprietaire" on public.documents_stage
  for all to authenticated
  using (public.peut_acceder_stage(stage_id))
  with check (public.peut_acceder_stage(stage_id));

-- ---------------------------------------------------------------------------
-- Le bucket. Privé : un contrat de stage et une attestation portent des
-- données personnelles, ils ne se servent que par URL signée.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents-stage',
  'documents-stage',
  false,
  10485760, -- 10 Mo : une attestation scannée, pas une vidéo
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le premier segment du chemin est l'identifiant du stage : c'est lui qui
-- décide de l'accès, exactement comme pour la ligne en base.
create policy "documents_stage_lecture" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents-stage'
    and public.peut_acceder_stage(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_stage_depot" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents-stage'
    and public.peut_acceder_stage(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_stage_remplacement" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents-stage'
    and public.peut_acceder_stage(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_stage_retrait" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents-stage'
    and public.peut_acceder_stage(((storage.foldername(name))[1])::uuid)
  );
