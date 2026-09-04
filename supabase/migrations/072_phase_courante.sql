-- Avancement dans les phases pendant que la séance se déroule (PRD §4.3ter).
--
-- La colonne vit sur la séance, pas dans la fiche : la fiche est un contenu
-- partagé entre groupes parallèles (§4.3bis), alors que le fait d'en être à la
-- troisième phase appartient à la classe qui a lieu, ici, maintenant. Deux
-- groupes qui suivent la même fiche n'avancent pas au même rythme.
--
-- 0 = rien de commencé, 4 = les quatre phases sont faites.

alter table public.seances
  add column if not exists phase_courante smallint not null default 0
    check (phase_courante between 0 and 4);

comment on column public.seances.phase_courante is
  'Nombre de phases terminées du déroulement guidé (PRD §4.3ter), 0 à 4.';
