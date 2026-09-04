-- Partage d'une correction de TP avec les stagiaires (PRD §4.4).
--
-- La migration 073 fermait la correction aux stagiaires en permanence. Le PRD
-- tranche autrement : ni fermée d'office, ni ouverte automatiquement une fois
-- le TP rendu — le formateur décide, correction par correction.
--
-- Le drapeau vit donc sur la ligne de correction, pas sur la séance ni sur le
-- module : « un formateur peut vouloir partager la correction d'un TP et
-- garder celle d'un autre pour lui ».

alter table public.corrections_tp
  add column if not exists partagee_avec_stagiaires boolean not null default false;

comment on column public.corrections_tp.partagee_avec_stagiaires is
  'Le formateur a ouvert cette correction à ses stagiaires (PRD §4.4). Faux par défaut, y compris après que la séance est faite. Retirer le partage ferme les accès futurs — il n''efface pas ce qui a déjà été consulté.';

-- ── Lecture stagiaire : partagée ET dans son groupe ───────────────────────
--
-- Les deux conditions sont nécessaires. Le drapeau seul laisserait la
-- correction d'un TP de DDOUX201 visible d'un stagiaire de DES101 ; le groupe
-- seul rouvrirait tout ce que le formateur garde pour lui.

drop policy if exists "corrections_tp_lecture_stagiaire" on public.corrections_tp;
create policy "corrections_tp_lecture_stagiaire" on public.corrections_tp
  for select to authenticated
  using (
    partagee_avec_stagiaires
    and exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = corrections_tp.seance_id
        and sg.groupe_id = public.groupe_du_stagiaire()
    )
  );
