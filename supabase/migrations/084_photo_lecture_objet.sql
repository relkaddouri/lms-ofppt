-- La photo de stagiaire n'a jamais pu être déposée — il manquait la lecture.
--
-- Le bucket est public : les images s'affichent, et rien dans l'écran ne
-- laissait deviner qu'une policy manquait. Mais `public` ne concerne que le
-- point d'accès de lecture des fichiers ; la ligne de `storage.objects`, elle,
-- reste sous RLS, et aucune policy `select` n'existait pour ce seau — les deux
-- autres, `documents-stage` et `rendus-devoir`, en ont une.
--
-- Le dépôt utilise `upsert` : le chemin d'une photo est stable (`<id>/photo.jpg`),
-- de sorte qu'un remplacement écrase au lieu d'accumuler des orphelins. Or
-- `upsert` se traduit par `insert … on conflict do update`, et PostgreSQL
-- exige alors de pouvoir *lire* la ligne en conflit. Sans policy de lecture,
-- il refuse — avec « new row violates row-level security policy », qui désigne
-- l'écriture et non la lecture, ce qui a envoyé chercher au mauvais endroit.
--
-- Symptôme : zéro objet dans le seau, zéro fiche avec photo, depuis la
-- migration 081. Le retrait était logé à la même enseigne — `remove()` lit
-- avant de supprimer.
--
-- Reproduit en base avant correction : le même `insert` passe seul et échoue
-- avec `on conflict`, puis passe de nouveau une fois cette policy créée.

drop policy if exists "photos_stagiaire_lecture" on storage.objects;
create policy "photos_stagiaire_lecture" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos-stagiaire'
    and public.peut_gerer_photo(((storage.foldername(name))[1])::uuid)
  );
