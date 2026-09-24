-- 096_ouverture_de_tout_controle.sql — aucun contrôle n'est visible avant d'être ouvert
--
-- Un contrôle validé devenait aussitôt lisible par tout le groupe : le sujet
-- d'un CC préparé une semaine à l'avance était déjà entre les mains des
-- stagiaires. Seuls les contrôles de test demandaient une ouverture explicite
-- (migration 091). Cette règle vaut désormais pour tous : CC, EFM et test.
--
-- Valider prépare, ouvrir donne accès. La fermeture est calculée à
-- l'ouverture, à partir de la durée du contrôle : un contrôle de 2 h se ferme
-- deux heures après avoir été ouvert, sans que le formateur ait à la saisir.
--
-- Ce qu'un stagiaire garde : sa propre copie, une fois rendue. Fermer le
-- contrôle ne la lui reprend pas, et son résultat s'affichera à la
-- publication.

alter table public.controles drop constraint if exists controles_ouverture_test;
alter table public.controles
  add constraint controles_ouverture check (
    ouvert_le is not null or ferme_le is null
  );

comment on column public.controles.ouvert_le is
  'Moment où le formateur a ouvert le contrôle au groupe. Null : le groupe ne le voit pas, même validé.';
comment on column public.controles.ferme_le is
  'Fin de la passation, calculée à l''ouverture avec la durée du contrôle. Null : ouvert jusqu''à fermeture manuelle.';

create or replace function public.controle_ouvert(c public.controles)
returns boolean
language sql
stable
set search_path = public
as $$
  select c.ouvert_le is not null
     and c.ouvert_le <= now()
     and (c.ferme_le is null or c.ferme_le > now());
$$;

drop policy if exists "controles_lecture_stagiaire" on public.controles;
create policy "controles_lecture_stagiaire" on public.controles
  for select to authenticated
  using (
    groupe_id = public.groupe_du_stagiaire()
    and (
      -- Le compte de test du formateur voit tout, y compris les brouillons :
      -- il existe pour essayer avant les stagiaires (migration 093).
      public.je_suis_stagiaire_de_test()
      or (statut = 'valide' and ouvert_le is not null)
      -- Une copie rendue reste consultable, même après fermeture.
      or exists (
        select 1
          from public.passations_controle p
          join public.stagiaires s on s.id = p.stagiaire_id
         where p.controle_id = controles.id and s.user_id = auth.uid()
      )
    )
  );
