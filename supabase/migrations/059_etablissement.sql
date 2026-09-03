-- Identité de l'établissement du formateur.
--
-- Le tableau de service (PRD §4.13bis) porte une colonne EFP que rien dans le
-- schéma ne pouvait remplir : elle sortait vide. Plus largement, tous les
-- documents produits par l'application s'en tenaient au sigle « OFPPT » écrit
-- en dur, alors qu'un document remis à la Direction porte le nom du centre.
--
-- Le logo est stocké en data URL plutôt que dans un bucket : il pèse quelques
-- dizaines de kilo-octets, il est lu par les seuls générateurs de PDF, et cela
-- évite un bucket, ses policies et des URL signées pour une image par compte.

alter table parametres_formateur
  add column if not exists etablissement text,
  add column if not exists logo_etablissement text;

comment on column parametres_formateur.etablissement is
  'Nom du centre de formation, imprimé en tête des documents et dans la colonne EFP du tableau de service.';
comment on column parametres_formateur.logo_etablissement is
  'Logo du centre en data URL (image/png ou image/jpeg), imprimé en tête des documents.';

-- Un logo qui n'est pas une image bitmap ferait échouer jsPDF au moment de
-- l'export, c'est-à-dire loin de la saisie : le refus tombe à l'écriture.
alter table parametres_formateur
  drop constraint if exists parametres_formateur_logo_data_url;
alter table parametres_formateur
  add constraint parametres_formateur_logo_data_url
  check (
    logo_etablissement is null
    or logo_etablissement ~ '^data:image/(png|jpeg);base64,'
  );
