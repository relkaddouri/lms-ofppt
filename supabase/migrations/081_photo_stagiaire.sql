-- La photo d'un stagiaire (PRD §4.5).
--
-- Les listes de personnes affichent des initiales sur fond coloré. Le motif
-- tient pour un groupe qu'on connaît ; il tient mal quand le fil d'annonces
-- devient un lieu où l'on se félicite, et où « AB » ne dit plus qui parle.
--
-- Le chemin porte l'identifiant du stagiaire en premier segment, comme pour
-- les documents de stage : c'est lui qui décide de l'accès, exactement comme
-- la ligne en base. Le fichier lui-même s'appelle toujours `photo`, si bien
-- qu'un remplacement écrase le précédent au lieu d'accumuler des orphelins.

alter table public.stagiaires
  add column if not exists photo text;

comment on column public.stagiaires.photo is
  'Chemin de la photo dans le bucket « photos-stagiaire ». Nul tant qu''aucune photo n''a été déposée.';

-- ── Le bucket ──────────────────────────────────────────────────────────────
--
-- Public en lecture : une photo de trombinoscope s'affiche dans un fil que
-- tout le groupe consulte, et signer chaque URL à chaque rendu coûterait une
-- requête par visage. Ce que le bucket contient n'a rien de confidentiel au
-- sein de l'établissement — mais le dépôt, lui, reste strictement borné.
--
-- 2 Mo suffisent largement pour un portrait ; au-delà, c'est une photo non
-- redimensionnée qu'il vaut mieux refuser tout de suite que stocker.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos-stagiaire',
  'photos-stagiaire',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Qui peut déposer ───────────────────────────────────────────────────────
--
-- Le stagiaire pour lui-même, le formateur pour les siens. La fonction dit
-- l'un et l'autre en un seul endroit, pour que les quatre policies ne
-- divergent pas.
create or replace function public.peut_gerer_photo(p_stagiaire uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.stagiaires s
     where s.id = p_stagiaire
       and (
         s.user_id = auth.uid()
         or public.peut_acceder_groupe(s.groupe_id)
       )
  );
$$;

grant execute on function public.peut_gerer_photo(uuid) to authenticated;

drop policy if exists "photos_stagiaire_depot" on storage.objects;
create policy "photos_stagiaire_depot" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos-stagiaire'
    and public.peut_gerer_photo(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "photos_stagiaire_remplacement" on storage.objects;
create policy "photos_stagiaire_remplacement" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos-stagiaire'
    and public.peut_gerer_photo(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "photos_stagiaire_retrait" on storage.objects;
create policy "photos_stagiaire_retrait" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos-stagiaire'
    and public.peut_gerer_photo(((storage.foldername(name))[1])::uuid)
  );

-- ── Qui peut écrire la colonne ─────────────────────────────────────────────
--
-- La policy d'écriture de `stagiaires` est réservée au formateur : sans cette
-- fonction, un stagiaire pourrait déposer son fichier sans jamais pouvoir
-- l'enregistrer sur sa fiche. Elle ne touche que `photo`, jamais le nom, le
-- CEF ni le groupe — un stagiaire ne se renomme pas.
create or replace function public.enregistrer_photo_stagiaire(
  p_stagiaire uuid,
  p_chemin text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.peut_gerer_photo(p_stagiaire) then
    raise exception 'Accès refusé à cette fiche.';
  end if;

  update public.stagiaires
     set photo = p_chemin
   where id = p_stagiaire;
end;
$$;

grant execute on function public.enregistrer_photo_stagiaire(uuid, text) to authenticated;
