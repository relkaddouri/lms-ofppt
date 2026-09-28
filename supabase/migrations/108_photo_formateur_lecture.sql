-- La photo du formateur ne pouvait pas être déposée — il manquait la lecture.
--
-- Exactement la faute de la migration 081, corrigée par la 084, et refaite à
-- l'identique par la 106 : le seau « photos-formateur » a ses trois policies
-- d'écriture et aucune policy de lecture.
--
-- `public` ne concerne que le point d'accès de lecture des *fichiers* ; la
-- ligne de `storage.objects`, elle, reste sous RLS. Or le dépôt utilise
-- `upsert` — le chemin d'une photo est stable (`<id>/photo.jpg`), de sorte
-- qu'un remplacement écrase au lieu d'accumuler des orphelins — et `upsert`
-- se traduit par `insert … on conflict do update` : PostgreSQL exige alors de
-- pouvoir *lire* la ligne en conflit. Sans policy de lecture, il refuse avec
-- « new row violates row-level security policy », qui désigne l'écriture et
-- non la lecture — le message même qui avait envoyé chercher au mauvais
-- endroit en 081.
--
-- Le retrait est logé à la même enseigne : `remove()` lit avant de supprimer.
--
-- On lit chez soi, comme on y écrit : le fichier, lui, est servi publiquement
-- par le point d'accès du seau, et c'est par là que les stagiaires voient ce
-- visage.
drop policy if exists "photos_formateur_lecture" on storage.objects;
create policy "photos_formateur_lecture" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos-formateur'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
