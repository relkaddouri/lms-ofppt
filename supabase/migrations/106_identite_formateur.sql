-- L'identité du formateur, telle que les stagiaires la voient.
--
-- Dans le fil, une annonce était signée « Votre formateur » et un commentaire
-- « Formateur », faute de savoir son nom : `parametres_formateur.nom_formateur`
-- existe depuis le tableau de service, mais cette table n'est lisible que par
-- son propriétaire — un stagiaire n'en tire rien.
--
-- L'identité publique va donc sur `profils`, qui porte déjà l'identifiant du
-- compte et son rôle, et dont on ouvre la lecture aux seules lignes de
-- formateur. Le nom et le visage de qui anime le groupe ne sont pas un secret
-- au sein de l'établissement ; le reste de la table — les rôles des autres
-- comptes — le reste.

alter table public.profils
  add column if not exists nom_complet text,
  add column if not exists photo text;

alter table public.profils
  drop constraint if exists profils_nom_complet_longueur;
alter table public.profils
  add constraint profils_nom_complet_longueur
  check (nom_complet is null or char_length(nom_complet) <= 120);

comment on column public.profils.nom_complet is
  'Nom sous lequel le formateur se présente aux stagiaires. Nul tant qu''il ne l''a pas renseigné : l''affichage retombe alors sur « Votre formateur ».';
comment on column public.profils.photo is
  'Chemin de la photo dans le bucket « photos-formateur ». Nul tant qu''aucune photo n''a été déposée.';

-- ── Qui lit cette identité ─────────────────────────────────────────────────
--
-- Tout compte connecté, et pour les seules lignes de formateur ou d'admin.
-- Un stagiaire ne voit donc ni le rôle ni l'identité d'un autre stagiaire —
-- ce qu'il sait déjà de ses camarades, il le sait par `stagiaires`, qui est
-- bornée à son groupe.
drop policy if exists "profils_select_identite_formateur" on public.profils;
create policy "profils_select_identite_formateur" on public.profils
  for select to authenticated
  using (role in ('formateur', 'admin'));

-- ── Le bucket ──────────────────────────────────────────────────────────────
--
-- Mêmes règles que « photos-stagiaire » : public en lecture, parce qu'un
-- visage s'affiche en tête de chaque annonce d'un fil que tout le groupe
-- consulte, et que signer cette URL à chaque rendu coûterait une requête pour
-- rien. Le dépôt, lui, est borné au dossier qui porte l'identifiant du compte.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos-formateur',
  'photos-formateur',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le premier segment du chemin est l'identifiant du compte : chacun n'écrit
-- que chez lui, et personne n'a à écrire chez un autre — il n'y a pas ici
-- l'équivalent du formateur qui dépose la photo de ses stagiaires.
drop policy if exists "photos_formateur_depot" on storage.objects;
create policy "photos_formateur_depot" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos-formateur'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "photos_formateur_remplacement" on storage.objects;
create policy "photos_formateur_remplacement" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos-formateur'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "photos_formateur_retrait" on storage.objects;
create policy "photos_formateur_retrait" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos-formateur'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Écrire son identité passe par « profils_update_own », qui existe depuis la
-- migration 002 : chacun modifie sa propre ligne. La migration 107 y ajoute
-- le garde-fou qui manquait — le rôle, lui, ne se change pas d'ici.
