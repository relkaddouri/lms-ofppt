-- Rendu de devoir sous forme de fichier (PRD §4.7 / backlog 7.3).
--
-- `devoirs.type_rendu` acceptait « fichier » depuis la migration 040, dont le
-- commentaire l'annonçait déjà : « suppose un espace de stockage, qui n'est pas
-- encore configuré ». Le formateur pouvait donc demander un fichier, et le
-- stagiaire n'avait nulle part où le déposer.
--
-- Bucket dédié plutôt que réemploi de `documents-stage` : les quatre policies
-- de celui-ci exigent un identifiant de stage comme premier segment de chemin
-- et sa liste MIME est faite pour des pièces de stage. Les élargir reviendrait
-- à desserrer la garde des documents de stage pour un besoin qui n'a rien à
-- voir.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rendus-devoir',
  'rendus-devoir',
  false,
  20971520, -- 20 Mo : un rendu peut porter des maquettes, pas seulement du texte
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Ce que la copie garde du fichier ──────────────────────────────────────
--
-- Le chemin suffirait à retrouver l'objet, mais pas à le rendre : le nom
-- d'origine est celui que le stagiaire a choisi et que le formateur doit
-- revoir au téléchargement, et la taille permet de l'annoncer avant de
-- lancer le transfert.

alter table public.devoirs_rendus
  add column if not exists fichier_chemin text,
  add column if not exists fichier_nom text,
  add column if not exists fichier_taille bigint;

comment on column public.devoirs_rendus.fichier_chemin is
  'Chemin dans le bucket rendus-devoir, au format <devoir_id>/<stagiaire_id>/<fichier>.';
comment on column public.devoirs_rendus.fichier_nom is
  'Nom d''origine choisi par le stagiaire, restitué au téléchargement.';

-- ── Qui accède à quoi ─────────────────────────────────────────────────────

-- Le formateur du groupe auquel le devoir est adressé.
create or replace function public.peut_acceder_devoir(p_devoir_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.devoirs d
    where d.id = p_devoir_id and public.peut_acceder_groupe(d.groupe_id)
  );
$$;

-- La fiche stagiaire rattachée au compte connecté.
create or replace function public.est_mon_stagiaire(p_stagiaire_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stagiaires s
    where s.id = p_stagiaire_id and s.user_id = auth.uid()
  );
$$;

-- Le devoir s'adresse-t-il au groupe du stagiaire connecté ? Sans cela, un
-- stagiaire pourrait déposer dans le dossier d'un devoir d'un autre groupe,
-- son propre identifiant en second segment suffisant à passer la règle.
create or replace function public.peut_lire_devoir(p_devoir_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.devoirs d
    where d.id = p_devoir_id and d.groupe_id = public.groupe_du_stagiaire()
  );
$$;

revoke execute on function public.peut_lire_devoir(uuid) from public, anon;
grant execute on function public.peut_lire_devoir(uuid) to authenticated;

revoke execute on function public.peut_acceder_devoir(uuid) from public, anon;
revoke execute on function public.est_mon_stagiaire(uuid) from public, anon;
grant execute on function public.peut_acceder_devoir(uuid) to authenticated;
grant execute on function public.est_mon_stagiaire(uuid) to authenticated;

-- ── Policies du bucket ────────────────────────────────────────────────────
--
-- Le chemin porte la règle : <devoir_id>/<stagiaire_id>/<fichier>. Le
-- stagiaire est maître de son propre dossier et de lui seul ; le formateur
-- lit tout ce qui relève de ses devoirs, et peut retirer un fichier — mais
-- jamais en déposer un à la place d'un stagiaire.

drop policy if exists rendus_devoir_stagiaire on storage.objects;
create policy rendus_devoir_stagiaire on storage.objects
  for all to authenticated
  using (
    bucket_id = 'rendus-devoir'
    and est_mon_stagiaire(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'rendus-devoir'
    and est_mon_stagiaire(((storage.foldername(name))[2])::uuid)
    and peut_lire_devoir(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists rendus_devoir_lecture_formateur on storage.objects;
create policy rendus_devoir_lecture_formateur on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rendus-devoir'
    and peut_acceder_devoir(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists rendus_devoir_retrait_formateur on storage.objects;
create policy rendus_devoir_retrait_formateur on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rendus-devoir'
    and peut_acceder_devoir(((storage.foldername(name))[1])::uuid)
  );
