-- 104_partage_lecture_stagiaire.sql — le contenu partagé se lit aussi côté
-- stagiaire (§4.3bis, signalé le 28 septembre 2026)
--
-- Le partage entre groupes parallèles pose sur la séance du second groupe un
-- `contenu_source_id` : elle n'a plus de fiche ni de support à elle, elle
-- désigne ceux de la première. Le formateur suit ce renvoi depuis
-- `sourceContenu()` ; la politique des stagiaires, elle, ne le suivait pas.
--
-- Conséquence observée sur DES102, dont trois séances ont été liées à celles
-- de DES101 : ses dix-huit stagiaires lisaient **zéro** support. Le cours
-- existait, il n'était simplement pas à eux au sens de la politique.
--
-- La lecture suit donc le renvoi : un stagiaire lit le support de sa séance,
-- ou celui de la séance dont la sienne tient son contenu. Rien d'autre ne
-- change — le support reste réservé aux destinataires « stagiaire », et à
-- ceux du groupe concerné.

drop policy if exists "supports_lecture_stagiaire" on public.supports_seance;

create policy "supports_lecture_stagiaire" on public.supports_seance
  for select to authenticated
  using (
    destinataire = 'stagiaire'
    and exists (
      select 1
      from public.seance_groupes sg
      join public.seances s on s.id = sg.seance_id
      where sg.groupe_id = public.groupe_du_stagiaire()
        and (
          sg.seance_id = supports_seance.seance_id
          -- La séance du stagiaire est un miroir : son contenu est porté par
          -- la séance qu'elle désigne.
          or s.contenu_source_id = supports_seance.seance_id
        )
    )
  );
