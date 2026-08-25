-- Généré par scripts/import_programme.py depuis programme-ux-designer.docx.
-- Ne pas éditer à la main : régénérer après correction de programme.json.
-- Idempotent.

insert into public.specialites (nom, code, duree_totale_heures) values ('Digital Design - Option UX Design', 'DIA_DES_TS', 1435)
on conflict (code) do update set nom = excluded.nom, duree_totale_heures = excluded.duree_totale_heures;

insert into public.programmes (specialite_id, annee_approbation) select id, 2021 from public.specialites where code = 'DIA_DES_TS'
on conflict (specialite_id, annee_approbation) do nothing;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 1, 'DIA_DES_TS-01', 'M101', 'Se situer au regard du métier et de la démarche de formation', 15, 'tronc_commun')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DES_TS-01'), 'Individuellement et/ou en groupe
À partir :
De mises en situations écrites et orales
De consignes
De spécifications fonctionnelles
De base documentaire
À l’aide :
D’internet
Du réseau professionnel', 'Identification précise des différents métiers
Utilisation judicieuse des outils de recherche d’emploi
Suivi d’une démarche adéquate pour la connaissance du marché du travail
Connaissance approfondie du cadre de formation proposé')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')), 'A', 'Découvrir les spécificités des métiers du Design', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 1), 'Compréhension générale des métiers liés au Design', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 1), 'Identification globale des différents métiers du Design', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 1), 'Recueil ciblé des compétences mobilisées', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 1), 'A.1', 'S’informer sur le marché du travail', 'Identification des secteurs d’activité liés au Design
Représentation du contexte de travail selon les secteurs des entreprises', 'Seul ou en groupe
Selon les instructions verbales ou écrites du formateur
À l’aide des ressources fournis par le formateur (polycop, documents, cours)
Quizz sur le secteur d’activité du digital au Maroc
Vidéos témoignages et interviews de professionnels qui décrivent leur entreprise et leur métier', 70.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 1), 'A.2', 'Se renseigner sur les compétences métier', 'Listing des comportements et postures professionnelles à adopter
Reconnaissances des missions et tâches à effectuer dans les métiers de l’Design', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')), 'B', 'Identifier les modalités de formation', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 2), 'Cartographie des compétences de l’année 1', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 2), 'Cartographie des compétences de l’année de spécialisation', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 2), 'Usage des ressources de formation', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 2), 'B.2', 'Comprendre les objectifs de la formation', 'Connaissance des objectifs à atteindre au terme de la formation
Utilisation des ressources pédagogiques
Recueil sur les différents modes d’évaluation durant le parcours de formation', 'Seul ou en groupe
Selon les instructions verbales ou écrites du formateur
À l’aide des supports pédagogiques mis à disposition durant la formation sur la plateforme d’apprentissage
Investigations sur les secteurs d’activités auprès de professionnels et entreprises
Création d’un compte sur un réseau professionnel', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 2), 'B.2', 'Situer les compétences de la formation', 'Visualisation sous forme de cartographie des compétences de l’année 1
Visualisation sous forme de cartographie des compétences de l’année de spécialisation', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-01')) and e.ordre = 2), 'B.3', 'Projeter sa formation dans le milieu de travail', 'Utilisation des réseaux professionnels
Compréhension des marchés de l’emploi (ouvert, cache)
Observation du milieu de travail', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 2, 'DIA_DES_TS-02', 'M102', 'Identifier les enjeux digitaux chez l’utilisateur', 60, 'tronc_commun')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DES_TS-02'), 'Individuellement
À partir :
De mises en situations orales
À l’aide :
De documentations numériques sur l’histoire du digital et du web
De documentations numériques sur le graphisme et son évolution
D’ouvrages spécialisés sur le numérique, ses enjeux et le monde du design en général', 'Utilisation appropriée du vocabulaire lié au numérique
Délimitation claire des différents métiers
Écoresponsabilité des services digitaux prise en compte
Utilisation appropriée des termes techniques
Analyse pertinente de solutions digitales en lien avec les utilisateurs')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')), 'A', 'Connaitre l’histoire du web', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 1), 'Identification générique des origines du Web et de ses évolutions', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 1), 'Application pertinente des définitions principales du Web', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 1), 'Différenciation pertinente entre intranet et extranet comprise', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 1), 'A.1', 'Identifier les utilisations du web', 'Contexte historique, lexique
et vocabulaire utilisés', 'Seul
À partir de mises en situations orales
À l’aide de documentations numériques sur l’histoire du digital et du web
À l’aide d’ouvrages spécialisés sur le numérique, ses enjeux et le monde du design en général
Contextualiser et définir les éléments principaux
Analyser des sites sur différents supports en groupe
Échanger sur les types de supports utilisés (quizz / utilisation des élèves, etc.)', 10.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 1), 'A.2', 'Connaitre les évolutions de solutions digitales utilisant les technologies du Web', 'Notions autour de l’Adaptative et responsive dans la conception des solutions digitales
Usages du Mobile First et applications mobiles', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')), 'B', 'Définir les éléments du web', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 2), 'Considération générale du fonctionnement du modèle du Web (routeurs, client-serveur)', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 2), 'Utilisation pertinente du système de protocoles', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 2), 'Identification concise des FTP, DNS, SSH, SSL correcte', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 2), 'Connaissances globales de l’écosystème des métiers digitaux', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 2), 'Connaissance succincte des différents types de services web', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 2), 'Lien cohérent entre service et technologie', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 2), 'B.1', 'Identifier les types de sites', 'Liste des principaux types de sites
Différenciation des types de sites
Utilisation des types de site selon le projet digital à concevoir', 'A partir d’études de cas visuelles
À l’aide de documentations numériques sur le design web et son évolution
Analyser des sites et noter leurs principales différences
Discuter sur les éléments différenciant les solutions digitales
Construire les définitions', 20.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 2), 'B.2', 'Connaitre l’écosystème du web', 'Liste des différents métiers travaillant sur la création de contenu digital
Impact du Digital dans la société
Notions de règlementation du Web', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 2), 'B.3', '. Connaitre les termes techniques liés aux sites web', 'Noms de domaine
Liste des différents protocoles
Normes W3C
Notions de base de données et de compte utilisateur
Méthodes d’hébergement des solutions digitales', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')), 'C', 'Analyser la composition d’une solution digitale', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'Représentation constitutive des composants d’une solution digitale', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'Connaissances de base des langages principaux liés au Web', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'Connaissance succincte de l’utilisation des bibliothèques et des frameworks', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'Repérage des outils de conceptions graphiques et d’animation', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'Représentation des concepts de navigation d’un site', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'Utilisation judicieuse des règles de composition des éléments', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'Identification des codes graphiques de la composition d’un site', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'Simplification de l’accessibilité visuelle des éléments', 8)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'C.1', 'Distinguer les anciens codes de construction d’un site des nouveaux', 'Définition des principaux langages
Règles de composition d’un site classique
Définition des principes d’accessibilité
Contenu textuel, visuel et interactif (callToAction par exemple)
Architecture organisationnelle des pages (accueil, contenu, navigation…)', 'Seul
À partir de sites proposés par le formateur et de documentations numérique
Définir les principes de composition
Analyser différentes structures avec les élèves
Exercices de distinction de sites
Identifier les langages', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 3), 'C.2', 'Reconnaître les différentes parties d’un site', 'Composition de la structuration des pages par zone
Différents types de menus de navigation', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')), 'D', 'Maitriser les règles du web', 4)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'Principe de l’Interface Homme-Machine (IHM)', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'Connaissances acquises sur la base du SEO', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'Application des lois de l’UX selon la solution digitale', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'Identification des règles à mettre en place au sein de la solution digitale', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'Maitrise de la liste des composants obligatoires d’un site web', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'Aptitude à connaitre et anticiper les évolutions passées et futures du web', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'D.1', 'Connaitre les termes techniques liés au web', 'Définitions du Responsive
Usages du modèle Responsive
Notions de base sur le SEO', 'Seul
A l’aide de documentation technique
Expliquer les bases de construction d’un site
Questionner sur les aspects techniques du Web via un quizz
Exercices d’entrainement : analyser la construction d’un site', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'D.2', 'Comprendre la construction d’un site', 'Bases des langages utilisés dans le web
Notions sur les bibliothèques
Connaissance des frameworks', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'D.3', 'Connaitre les différentes évolutions de conception des interfaces', 'Historique des évolutions des styles graphiques et du design des interfaces digitales
Analyse des tendances de conception design des interfaces
Aperçu des fonctionnalités nouvelles orientées utilisateurs (webApps, réseaux sociaux, médias…)', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 4), 'D.4', 'Différencier la conception des interfaces utilisateurs de celle du développement', 'Connaissances des techniques et méthodologies utilisées
Notions sur les particularités des métiers
Aperçu sur les fonctions et la finalité des métiers
Notions sur le front-end et le back-end', null, null, 4)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')), 'E', 'Lier la solution digitale aux utilisateurs', 5)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 5), 'Connaissances précises des règlementations d’accessibilité', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 5), 'Étude sur l’impact du digital dans le comportement des utilisateurs', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 5), 'Principe user centrics compris', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 5), 'Analyse cohérente de la pertinence d’une solution pour ses utilisateurs', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 5), 'E.1', 'Développer une attitude tournée vers l’utilisateur', 'Appréhensions des méthodes d’UX Design
Techniques de compréhension des utilisateurs', 'Seul ou en équipe selon instructions du formateur
A partir d’ateliers et de jeux de rôle dans lesquels les stagiaires simulent des situations d’utilisateurs
A l’aide d’études de cas
Échange et prise de notes entre les étudiants avec écoute active afin de développer leur empathie
Cours théorique sur les caractéristiques des utilisateurs
Quizz interactif sur les types d’utilisateurs et leurs caractéristiques', 10.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 5), 'E.2', 'Comprendre la notion d’utilisateur', 'Notions sur les types d’utilisateurs
Fonctionnement d’un projet digital basé sur les utilisateurs', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-02')) and e.ordre = 5), 'E.3', 'Appréhender la mise en œuvre d’une solution digitale', 'Quelques grands principes de fonctionnement de solutions digitales basées sur les utilisateurs
Présentation sommaire des étapes à mettre en œuvre', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 3, 'DIA_DES_TS-03', 'M103', 'Exploiter les règles du graphisme dans les solutions digitales', 105, 'tronc_commun')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DES_TS-03'), 'Individuellement puis en équipe
À partir :
De consignes
De recherches internet
De mises en situation écrites
À l’aide :
De documentations sur le projet
De documents sur le secteur et les clients
De logiciels de PAO
D’un navigateur', 'Connaissance complète du vocabulaire technique lié à l’univers du graphisme
Respect des codes graphiques
Utilisation appropriée des termes techniques
Analyse pertinente d’identités visuelles
Adaptabilité correcte aux solutions digitales
Adaptabilité de la hiérarchie aux différents supports')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')), 'A', 'Connaitre les significations des éléments graphiques', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 1), 'Identification des types d’éléments graphiques composants une interface digitale (icones, images, médias visuels ou sonores…)', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 1), 'Règles des espaces colorimétriques (RVB, codes hexadécimaux, CMJN)', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 1), 'Utilisation du cercle chromatique pour un choix pertinent des couleurs', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 1), 'Choix judicieux des styles de typographies', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 1), 'A.1', 'Identifier différents éléments graphiques', 'Vocabulaire technique lié à la conception d’interface utilisateurs (zoning, wireframe, templates)
Vocabulaire des éléments graphiques
Logiciels de PAO utilisés pour chaque type d’élément graphique (vectoriel, bitmap, médias)
Cas d’usage des éléments graphiques
Les styles d’éléments visuels
Les normes de placement entre les éléments graphiques (espacement, répartition texte et éléments graphiques…)
Les règles d’utilisation des icônes (dimensions, usages)', 'Seul
À l’aide de documents techniques fourni par le formateur
Cours théorique et définitions du vocabulaire technique pour renforcer la mémorisation des connaissances mobilisés
Remue-méninges avec les apprenants sous forme de débat/discussions encadrés par le formateur sur les thèmes du graphisme et de leur compréhension
Exercices pratiques : donner un sujet aux apprenant (un brief)
Proposer des couleurs
Proposer des typographies
Déduire les logiciels qui seront utilisés pour le projet
Justifier ses choix graphiques pour le sujet', 10.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 1), 'A.2', 'Distinguer les cas d’utilisation des couleurs', 'Introduction des règles colorimétriques (significations, règles, usages selon le contexte…)
Utilisation du cercle chromatique', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 1), 'A.3', 'Différencier les styles de typographie', 'Identification des différents types de typographies
Liste des styles de typographies
Règles de base typographique à utiliser selon le niveau hiérarchique du contenu (titre 1, titre 2, paragraphe, chapeau…)
Cas d’usage des typographies', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 1), 'A.4', 'Comprendre l’approche psychologique des éléments graphiques', 'Le sens des formes selon les cultures et les secteurs d''activités
Signification des éléments graphiques selon les cultures et les secteurs d''activités
Codes et fonctions des visuels utilisés', null, null, 4)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')), 'B', 'S’appuyer sur les règles élémentaires du graphisme', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'Différenciation entre graphisme et design comprise', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'Maitrise du langage propre au graphisme', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'Utilisation pertinente de l’iconographie', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'Méthodes de hiérarchisation des typographies', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'Utilisation correcte des profils colorimétriques', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'Prise en compte des codes de résolution des écrans', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'Utilisation adéquate des différents formats d’images (JPEG, PNG, GIF, SVG)', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'Règles de tiers, de proximité, d’alignement dans le respect des normes établis pour les interfaces de solutions digitales', 8)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'Règles d’accessibilité et d’inclusive design', 9)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'B.1', 'Distinguer des identités visuelles différentes', 'Découverte de l’Histoire de l’art
Définition du graphisme et du Design
Aperçu des modèles de Design (PopArt, Flat Design, Material Design…)
Application graphique selon les valeurs associées à la marque
Utilisation du graphisme comme vecteur d’un message', 'Seul
À partir de documents fournis par le formateur
A l’aide d’études de productions graphiques proposées par le formateur
Définitions des termes associés au graphisme et Design
Analyse en groupe de marques : style graphique, choix de couleurs, de formes et de typographies et expliquer la raison
Cours théorique sur les usages des styles graphiques et formats d’exportation', 20.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'B.2', 'Utiliser des styles graphiques', 'Documents d’identités visuelles de marques
Utilisation des tendances graphiques
Compréhension de langage propre au graphisme
Utilisation de différents formats de fichiers d’exportation (images, polices, vidéos…)', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 2), 'B.3', '. Comprendre la mise en place de production', 'Fonctionnement créatif
Répartition texte / image /icones/vidéo
Règles de compositions graphiques sur les solutions digitales', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')), 'C', 'Utiliser des codes graphiques appropriées selon le secteur identifié', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 3), 'Différenciation des grandes typologies de secteurs d’activités (services en ligne, commerces, administrations publiques…)', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 3), 'Pertinence graphique', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 3), 'Respect des contraintes graphiques et ergonomiques des secteurs', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 3), 'Utilisations graphiques en adéquation avec le secteur', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 3), 'C.1', 'Repérer divers secteurs d’activité', 'Typologies de secteurs
Codes visuels et graphiques des secteurs', 'En équipe selon instructions du formateur
À partir de consignes, de mises en situation écrite ou orales, de recherches internet
A l’aide de documents sur un projet
A l’aide d’un logiciel de PAO ou d’un outil de mise en forme
Cours théorique sur les typologies des secteurs et de leurs spécificités graphiques
Travail en groupe court sur des recherches graphiques liées à un secteur d’activité
Pour une marque donnée, proposer une courte identité visuelle qui serait adaptée au secteur', 15.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 3), 'C.2', 'Distinguer les spécifications graphiques', 'Mise en place de bonnes pratiques
Connaissance en adéquation avec les valeurs de marque
Identification des contraintes liées au secteur
Compréhension des objectifs de communication du secteur
Utilisations graphiques des secteurs', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')), 'D', 'Appréhender la hiérarchisation de contenus selon le support', 4)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 4), 'Hiérarchie des typographies logique', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 4), 'Maitrise du système de blocs en design', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 4), 'Utilisation cohérente de la pondération', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 4), 'Priorisation graphique adéquate', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 4), 'Respect des règles de mise en forme d’une hiérarchie', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 4), 'Cohérence entre les pages de même typologie ?', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 4), 'Hiérarchie bien pensée pour tous les types d’écran ?', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 4), 'D.1', 'Comprendre les principes de hiérarchie visuelle', 'Utilisation des systèmes de blocs
Méthode de priorisation des contenus textuels au sein des zones de blocs (article, section, header…)
Règles de hiérarchisation des contenus par bloc', 'Seul
A partir d’exemples proposés par le formateur
A l’aide de documents sur des projets web :
Cours théorique sur la hiérarchisation visuelle
Étude de cas autour de l’identification des contenus par blocs et hiérarchisation', 20.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 4), 'D.2', 'Distinguer les éléments principaux des éléments secondaires', 'Usage de pondération visuelle
Notions sur la mise en valeur d’éléments graphiques', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')), 'E', 'Construire les bases d’une identité visuelle', 5)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 5), 'Stratégie d’identité visuelle fonctionnelle', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 5), 'Réflexion créative aboutie', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 5), 'Pertinence graphique', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 5), 'Cohérence entre les éléments', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 5), 'Formalisation de la base de l’identité visuelle dans le cahier de charte graphique', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 5), 'E.1', 'Construire une réflexion créative', 'Pratique d’une méthodologie créative
Clarification d’objectifs selon l’identité visuelle à définir
Identification du concept créatif
Inclusion des composants visuels dans la démarche créative
Association du concept créatif et de la cible utilisateur', 'En équipe selon instructions du formateur
A partir de consignes, de documents de référence sur un sujet, de mise en situation écrite
A l’aide de recherches internet, d’un outil de PAO ou de mise en forme
Cours théorique sur la cohérence de l’identité visuelle
Sommaire d’une charte graphique classique et son contenu
En groupe sur un sujet donné, élaborer une identité visuelle complète et la mettre en forme dans une charte graphique', 35.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 5), 'E.2', 'Repérer la cohérence visuelle dans une identité', 'Usages graphiques en pratique
Adaptation selon le type de support des règles de composition visuelle et graphique
Analyse de la pertinence graphique
Visualisation d’une stratégie d’identité visuelle', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-03')) and e.ordre = 5), 'E.3', 'Rédiger la charte graphique', 'Recueil des éléments constitutifs de la charte graphique
Déclinaison des éléments de la charte graphique à tous les supports de diffusion (desktop, smartphone, tablette)
Argumentation des choix graphiques', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 4, 'DIA_DES_TS-04', 'M104', 'Analyser le contexte professionnel d’un projet d’UX / UI Design', 90, 'tronc_commun')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DES_TS-04'), 'En équipe
À partir :
D’un brief avec l’équipe projet interne et externe
Du cahier des charges du client
À l’aide :
Du cahier des charges du client
De documentation sur l’existant
De supports de communication de l’entreprise
De documentation annexe sur le projet
D’un document de données chiffrées
De productions marketing de l’entreprise
D’un outil de traitement de texte
D’un planning', 'Communication performante avec l’équipe
Analyse pertinente de la situation de l’entreprise
Compréhension précise des besoins
Synthèse concise et claire
Respect des délais et des process
Reformulation correcte et compréhensible')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')), 'A', 'Se situer dans le projet UX / UI', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 1), 'Vue d’ensemble des acteurs du projet', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 1), 'Utilisation pertinente des méthodes de communication d’équipe', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 1), 'Utilisation cohérente d’un planning', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 1), 'Maitrise de la circulation de l’information', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 1), 'Respect des livrables demandés', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 1), 'A.1', 'Appréhender la gestion de projet UX/UI', 'Définition du concept de projet
Compréhension de l’usage d’un cahier des charges au sein du projet
Identification des spécificités du projet UX/UI :
Phase de découverte de l’utilisateur
Analyse de sa propre expérience utilisateur
Étude de Benchmarking sur l’expérience utilisateur de la concurrence
Initiation au Design Thinking', 'Seul
A partir d’un cahier des charges
A l’aide d’un planning et de documentation proposée par le formateur
Quizz sur la notion de planning
Exercice d’application sur le processus d’un projet : hiérarchie, métier, étapes, etc.
Exercice d’application sur les phases de productions du projet
Exercice d’application sur la réalisation d’un planning de production
Quizz sur les pratiques de la méthode Agile
Exercice d’application sur la mise en place d’un projet selon la méthode Agile', 35.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 1), 'A.2', 'Connaitre la chaine de production', 'Connaissance de la fonction des différents acteurs dans un projet UX/UI
Connaissances des étapes de production
Identification du champ d’intervention au sein du projet (celui qui est en charge de l’expérience et de l’interface utilisateur dans le projet)', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 1), 'A.3', 'Découvrir les méthodes Agiles dans le projet UX/UI', 'Description de la culture Agile
Mise en œuvre les principales approches Agile (Scrum, Kanban, Lean...)
Identification du processus de mise en œuvre d’un projet Agile', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 1), 'A.4', 'Organiser un planning de production', 'Synthèse des informations concernant l’apprenant dans le cahier des charges
Planifier les actions à entreprendre', null, null, 4)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')), 'B', 'Analyser le contexte de l’entreprise', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 2), 'Précision de l’analyse des produits et/ou services', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 2), 'Description claire du fonctionnement de l’entreprise', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 2), 'Compréhension pertinente des méthodes de communication de l’entreprise', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 2), 'Liste correcte des concurrents', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 2), 'Cohérence des référents', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 2), 'Choix judicieux des éléments de positionnement', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 2), 'Maitrise de la réalisation d’une matrice SWOT', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 2), 'B.1', 'Comprendre ce que vend l’entreprise', 'Différenciation entre produits et services
Les typologies des entreprises (de services, de biens, plateforme en ligne, E-commerce…)
Recherches et analyse des données marketing relatives à l’entreprise', 'Seul
À partir d’ateliers et de jeux de rôles dans lesquels les stagiaires peuvent analyser le contexte de l’entreprise
À l’aide de références de documents utilisés en environnement de travail par les entreprises
Exercice d’application à réaliser seul ou en équipe sur les points suivants :
Mise en œuvre d’un relevé d’informations pertinentes ;
Organisation des informations recueillies à l’aide des outils fournis par le formateur.
Méthodologie de listing des concurrents et référents
Réalisation d’une matrice de positionnement', 35.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 2), 'B.2', 'Situer une entreprise dans un secteur d’activité donné', 'Analyse des concurrents et référents (Benchmark)
Méthodes de positionnement de l’entreprise par rapport aux concurrents (matrice)
Lien entre le positionnement de l’activité et le positionnement marketing', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')), 'C', 'Comprendre le besoin du projet', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 3), 'Pertinence des cibles établies', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 3), 'Reformulation correcte des objectifs', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 3), 'Lien logique entre besoin et solution', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 3), 'Anticipation de l’évolution des besoins', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 3), 'Recherches et analyse marketing pertinentes', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 3), 'Objectifs marketing clairs et ciblés', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 3), 'C.1', 'Repérer les clients', 'Définition des personnes ciblées par le projet
Analyse des habitudes clients
Clarification des besoins clients identifiés
Clarifications des objectifs marketing en lien avec les clients', 'Seul
Mise en pratique selon une approche par projet (sujet du projet proposé au formateur ou que le formateur peut également mettre en place)
Exercice d’application à réaliser seul ou en équipe sur les points suivants :
Les méthodes de ciblage des clients
Identification des besoins projet
Rédaction les objectifs SMART du projet', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-04')) and e.ordre = 3), 'C.2', 'Comprendre les objectifs du projet', 'Détermination des objectifs globaux du projet
Détermination d’objectifs SMART en lien avec les cibles
Détermination d’objectifs marketing', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 5, 'DIA_DES_TS-05', 'M105', 'Réaliser une veille graphique', 90, 'tronc_commun')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DES_TS-05'), 'Individuellement
À partir :
D’un brief
De données sur le projet
À l’aide :
D’outils de PAO
De recherches internet
De documentation sur le graphisme
D’études graphiques sur les secteurs', 'Recherche pertinente par rapport au projet
Pertinence de l’analyse de l’entreprise
Connaissances adaptées des codes graphiques
Cohérence entre l’univers graphique et le secteur')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')), 'A', 'Comprendre le positionnement de l’entreprise', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 1), 'Interprétation correcte des données', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 1), 'Positionnement cohérent', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 1), 'Utilisation pertinente du cahier des charges', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 1), 'Identification détaillée des codes du secteur d’activité', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 1), 'Analyse pertinente de l’existant graphique de l’entreprise', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 1), 'A.1', 'Effectuer des recherches pertinentes', 'Définition des secteurs d’activité de l’entreprise
Codes graphiques du secteur d’activité ciblé', 'Seul ou en groupe
À partir d’un exemple de brief client
Approche pédagogique d’investigation (recherches internet, documentation sur le graphisme, documentation sur les secteurs d’activité des entreprises)
Exercices d’application sur les points suivants :
Définir les secteurs et leurs codes graphiques
Proposer une recherche en équipe sur un secteur
Effectuer des recherches sur des outils pertinents
Produire différents moodboards sur différents secteurs', 25.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 1), 'A.2', 'Réaliser des moodboards cohérents', 'Choix des éléments graphiques à définir dans la conception du Moodboard
Synthèse visuelle cohérente en adéquation avec la cible d’activité de l’entreprise et la cible utilisateur', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')), 'B', 'Analyser le secteur d’activité de l’entreprise', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 2), 'Recherches appropriées et pertinentes', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 2), 'Choix des termes appropriés pour effectuer les recherches', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 2), 'Réalisation de moodboard cohérents avec le secteur et les cibles', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 2), 'Analyse juste des codes graphiques du secteur d’activité', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 2), 'B.1', 'Positionner l’entreprise dans son secteur', 'Identification détaillée des concurrents et référents graphiques du projet
Spécificités graphiques relevées dans le secteur d’activité', 'Seul ou en groupe
À partir d’un projet et de consignes issues du projet
Le projet met en application les éléments suivants :
Recherche de concurrents / référents graphiques
Analyser l’identité visuelle et la communication d’une entreprise en groupe
Proposition d’axes d’amélioration', 25.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 2), 'B.2', 'Analyser la situation d’une entreprise', 'Analyse de l’identité visuelle déjà en place
Analyse de la communication de l’entreprise avant le projet', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')), 'C', 'Établir un concept visuel', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 3), 'Choix graphiques adaptés au ciblage', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 3), 'Bonne cohérence graphique', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 3), 'Application maitrisée d’un style graphique', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 3), 'Organisation visuelle pertinente', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 3), 'Guidelines complètes et claires', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 3), 'C.1', 'Reconnaitre les clients ciblés', 'Analyse de cibles utilisateurs qui détermineront les axes de la conception des visuels
Mise en œuvre de codes et styles graphiques cohérents avec les cibles utilisateurs (colorimétrie, typographie, univers visuels…)', 'Seul ou en groupe
À partir d’un projet et de consignes issues du projet
Le projet met en application les éléments suivants :
Analyser l’identité visuelle et la communication d’une entreprise en groupe
Recherches internet, documentation sur le graphisme et les codes, choix des outils de PAO ou de mise en page
Définir le brief et les consignes relatifs au projet
Recherches graphiques cohérentes avec le secteur et les cibles d’un client fictif ou réel
Rédaction d’un document de guidelines graphiques pour ce client, comportant des typographies, des couleurs, des éléments graphiques et iconographiques', 50.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-05')) and e.ordre = 3), 'C.2', 'Créer une planche de style', 'Recherches graphiques qui définiront les axes de travail de la planche d’inspirations graphiques à produire
Mise en place de guidelines graphiques de la planche de style', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 6, 'DIA_DES_TS-06', 'M106', 'Déterminer les concepts de l’UX/UI Design', 120, 'tronc_commun')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DES_TS-06'), 'En équipe
À partir :
D’ateliers
De méthodologies
À l’aide :
D’outils de maquettage
D’outil de mise en forme de tableaux
De lois d’UX Design
Du cahier des charges', 'Maîtrise des outils de mise en forme
Attitude empathique envers les utilisateurs
Précision claire des données collectées
Organisation visuelle pertinente
Respect des codes graphiques')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')), 'A', 'Maitriser la méthodologie UX', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'Connaissances abouties des principes d’ergonomie', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'Compréhension adaptée des objectifs de l’UX', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'Respect des règles de l’UX', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'Application pertinente des lois', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'Méthodologie centrée sur les utilisateurs', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'Réalisation correcte des ateliers', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'Respect de la séquence des exercices', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'Mise en pratiques efficace des méthodes d’évaluation', 8)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'A.1', 'Définir l’UX Design', 'Usages de l’UX Design dans les solutions digitales
Lien entre marketing digital et solutions d’UX Design
Définition des lois d’UX Design comme la loi de Fitts, loi de Hick et la loi de proximité', 'Seul ou en groupe
A partir de consignes et de méthodologies définie selon une approche par projet/problème, exercices d’application selon les éléments suivants :
Détailler les méthodologies
Effectuer un projet en groupe : analyses quantitatives et qualitatives, tri par cartes (6 to 1)', 15.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 1), 'A.2', 'Présenter les méthodes et ateliers d’UX Design utilisés lors d’un projet', 'Méthodologie au Design thinking
Présentation de la méthode itérative
Méthode de tri par cartes et de 6 to 1
Différentiation entre évaluations quantitatives (sondages et A/B testing) et qualitatives (interview et tests d’utilisation)', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')), 'B', 'Mener une recherche utilisateurs', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 2), 'Attitude empathique', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 2), 'Appréhension juste des utilisateurs', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 2), 'Respect des délais', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 2), 'Respect des techniques de travail', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 2), 'Clarté des documents', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 2), 'Maîtrise du processus de conception', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 2), 'Création adaptée de zonings et de wireframes cohérents', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 2), 'B.1', 'Analyser l’existant sur les utilisateurs', 'Déterminer les clients ciblés
Analyser les données marketing relatives à l’utilisation des services / produits
Analyser les données chiffrées sur l’utilisation de la solution digitale si elle existe déjà', 'Présentation des différentes méthodes quantitatives et qualitatives d’analyse utilisateurs
Fournir différents documents collectant diverses données des utilisateurs d’un client
Créer un document organisé présentant un récapitulatifs des données pertinentes
Analyser les données en établissant un lien avec le projet et la solution digitale
Créer des personas à partir des données recueillies
Produire des user stories et des empathy maps sur la base des personas', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 2), 'B.2', 'Déterminer les utilisateurs de la solution digitale', 'Création de fiches personas pour créer les segments d’utilisateurs selon des caractéristiques (psychologiques, sociétales ainsi que d’autres caractéristiques des utilisateurs)
Production de user stories et d’empathy maps afin de personnaliser de manière pertinente les parcours des utilisateurs', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')), 'C', 'Définir les parcours utilisateur', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'Identification complète des typologies d’utilisation de la solution', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'Création de scénarios d’usage complets', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'Parcours utilisateurs cohérents avec le story mapping', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'Arborescence du parcours complète', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'Proposition d’axes d’amélioration pertinents', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'Création de zonings dans le respect du parcours utilisateurs', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'Création de wireframes cohérents avec l’utilisation des utilisateurs', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'C.1', 'Identifier des parcours utilisateurs', 'Présentation des typologies de parcours utilisateurs (acheteur, expérience magasin)
Réalisation de scénarios d’usage', 'Seul ou en groupe selon des consignes fournis dans le cadre des exercices de mise en application
Selon une approche par projet/problème issu d’un projet réel ou fictif, réalisation d’exercices d’application :
scénario d’usage, story mapping
Réaliser une arborescence et un parcours utilisateur
Tester le parcours en notifiant les points de vigilance en termes d’accessibilité et de trouvabilité
Réaliser en groupe des zoning papier puis des wireframes', 15.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'C.2', 'Créer des parcours utilisateurs', 'Création de story mapping permettant de définir précisément le besoin utilisateur au regard de la solution digitale.
Création de différents parcours utilisateurs issu du story mapping
Création de l’arborescence du parcours utilisateurs qui détermine le chemin de l’utilisateur', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'B.3', 'Relever des points d’amélioration', 'Analyse du parcours utilisateurs qui permette d’identifier les points d’amélioration
Règles d’accessibilité et de trouvabilité', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 3), 'B.4', 'Maquetter le parcours', 'Création de zoning pour concevoir une vue schématique du parcours utilisateur
Création de wireframes qui révèle une vue plus détaillée du parcours utilisateur', '
Seul ou en équipe selon instructions du formateur
A partir d’un brief
A l’aide de recherches internet, d’outil de PAO, de veille graphique
Débuter par de la théorie sur les règles et codes du design graphique
A partir du brief :
Effectuer des recherches graphiques
Réaliser un moodboard d’inspiration afin d’orienter la création de l’identité visuelle
Choisir une piste graphique et effectuer des choix de couleurs, de typographies et d’éléments graphiques
Justifier ses choix graphiques', null, 4)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')), 'D', 'Créer les éléments graphiques de l’interface utilisateur', 4)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 4), 'Utilisation correcte des logiciels', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 4), 'Clarté du guide de style', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 4), 'Délimitation précise des éléments graphiques', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 4), 'D.1', 'Identifier les éléments à designer dans la solution digitale', 'Formalisation des choix graphiques dans la charte graphique
Application de l’identité visuelle définie dans la charte graphique et validée par le client', 'Seul
A partir de documentation proposée par le formateur et de consignes
A l’aide d’outil de maquettage, de recherches graphiques
Quizz d’activités sur l’identification des éléments graphiques d’une interface
Exercice d’application :
Créer une page d’accueil selon le wireframe
Placer le contenu de manière pertinente vis-à-vis des exercices et ateliers sur les utilisateurs et la solution digitale du projet
Réaliser une planche d’éléments UI', 40.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-06')) and e.ordre = 4), 'D.2', 'Concevoir la maquette graphique de l’interface utilisateur', 'Utilisation de logiciels de maquettage (Figma, Adobe XD)
Application des codes graphiques définie sur les interfaces de solutions digitales (positionnement des blocs de navigation, contenu, footer…)
Organisation des contenus visuels et textuels qui définissent l’architecture de l’interface utilisateur', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 7, 'DIA_DES_TS-07', 'M107', 'Utiliser les logiciels de modélisation graphique', 120, 'tronc_commun')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DES_TS-07'), 'Individuellement
À partir :
De consignes d’utilisation
À l’aide :
De logiciel de PAO
De logiciel vectoriel
De logiciel bitmap
De logiciel de maquettage
De logiciel de prototypage', 'Utilisation judicieuse des fonctionnalités des logiciels
Panorama complet des logiciels
Utilisation pertinente des outils
Adaptabilité claire aux différents logiciels
Respect adéquat des règles d’utilisation
Utilisation appropriée du bon logiciel en fonction de la tâche à réaliser')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')), 'A', 'Identifier les logiciels de modélisation graphique', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 1), 'Gestion adaptée de l’espace de travail', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 1), 'Création cohérente de bibliothèques organisées', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 1), 'Utilisation pertinente des règles de maquettage', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 1), 'Connaissances approfondies des différents outils à disposition', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 1), 'Identification claire des différents logiciels et leurs spécificités', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 1), 'Capacité à choisir le logiciel le plus adapté au besoin graphique', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 1), 'A.1', 'Comprendre l’utilité des logiciels de modélisation graphique', 'Panorama des logiciels existants en modélisation et conception graphique
Définition des termes techniques utilisés dans les logiciels
Cas d’usage et exemples de production conçues à partir des logiciels
Définition de la création vectorielle et bitmap dans la conception graphique', 'Seul
A partir de documentation
A l’aide de logiciel de maquettage
Quizz sur les logiciels de PAO, de création vectorielle et de maquettage
Exercice d’application sous forme d’approche projet/problème sur la création d’un fichier et paramétrage du plan de travail et le positionnement de colonnes', 15.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 1), 'A.2', 'Connaître les fonctionnalités de base des logiciels de modélisation graphique', 'Préparation de l’environnement de travail
Création de bibliothèques de partage entre les logiciels
Gestion des espaces de travail personnalisés
Positionnement de règles, colonnes et grilles pour définir la future base de travail des maquettes', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')), 'B', 'Utiliser les logiciels de création vectorielle', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 2), 'Définition juste d’une création vectorielle', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 2), 'Justification adéquate du choix de l’utilisation du vectoriel plutôt que le bitmap', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 2), 'Création de visuels pertinents et bien construits grâce à des formes vectoriel', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 2), 'Choix des bons outils afin de parvenir au résultat graphique attendu', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 2), 'Utilisation pertinente et utile de bibliothèques', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 2), 'Choix d’export approprié au contexte et à la demande', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 2), 'B.1', 'Créer des formes vectorielles', 'Identification des outils de formes vectorielles
Utilisation des éléments graphiques à appliquer aux formes vectorielles (couleurs, contours, effets de la forme)
Gestion avancée de l’assemblage de forme (découpe de tracés, PathFinder)', 'Seul
A partir de consignes d’utilisation
A l’aide de logiciel de création vectorielle
Montrer le logiciel et ses outils
Exercices d’application guidée des outils principaux
Donner un brief aux apprenants afin de réaliser une composition vectorielle adaptée à un besoin (logo, icônes, illustration)', 25.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 2), 'B.2', 'Créer des bibliothèques de formes', 'Gestion des bibliothèques prédéfinies
Création de bibliothèques personnalisées', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 2), 'B.3', 'Exporter les compositions vectorielles', 'Types de fichiers pris en charge par le logiciel vectoriel
Choix du format d’exportation selon le support et le besoin', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')), 'C', 'Composer des créations graphiques bitmap', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'Retouches photographiques adaptée aux besoins et à l’univers du projet', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'Capacité de retouche réaliste d’éléments précis d’une composition photographique', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'Bonne organisation des éléments du photomontage', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'Assemblage pertinent d’éléments pour créer une composition', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'Création de compositions graphiques réalistes', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'Export de fichiers en qualité adaptée au besoin', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'Choix pertinent du format d’export des fichiers', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'C.1', 'Retoucher des photos', 'Réalisation du traitement photographique en matière de colorimétrie
Retouche des éléments de la photo (duplication ou suppression d’un élément de la photo)', 'Seul ou en équipe selon les indications du formateur
A partir de consignes
A l’aide d’un logiciel de création bitmap et de documentation sur la composition d’une interface
Fournir une image en précisant une demande paticulière
Demander aux apprenant d’effectuer une retouche colorimétrique de l’image
Créer un photomontage à partir de l’image et d’autres images trouvées par les apprenants
Créer une composition comprenant le photomontage et d’autres éléments graphiques tels que de la typographie, des formes, etc
Réaliser un export suivant les caractéristiques demandées par le formateur (taille, format…)', 20.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'C.2', 'Réaliser des photomontages', 'Préparation des éléments nécessaire au photomontage (calques, outils)
Assemblage des différents éléments nécessaires au photomontage (visuels-, textes, formes)', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 3), 'C.3', 'Exporter les compositions bitmap', 'Types de fichiers pris en charge par le logiciel bitmap
Choix du format d’exportation selon le support et le besoin', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')), 'D', 'Concevoir des maquettes prototypées', 4)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Hiérarchie identifiable des éléments', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Passage cohérent des wireframes au maquettes', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Design complet des états', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Conception organisée d’éléments principaux modifiables', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Gestion structurée des espaces', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Création organisée de composants', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Utilisation efficace des modes de création de guides de styles', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Mise en place aisée de guides d’utilisation', 8)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Déclinaison cohérente des maquettes sur différents types de supports', 9)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Créations de liens fonctionnels et logique dans les prototypes', 10)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Automatisation complète des éléments interactifs des prototypes', 11)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'Création d’animations adaptées au projet', 12)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'D.1', 'Créer des maquettes', 'Préparation de l’environnement de travail nécessaire à la création de la maquette
Structuration des éléments à intégrer dans la maquette
Import des fichiers externes (icônes, polices, images)
Création des bibliothèques de composants
Variantes de maquettes selon les supports desktop ou mobile', 'Seul ou en équipe selon les indications du formateur
A partir de consignes et de wireframes
A l’aide d’outil de maquettage et de documentation sur la composition d’une interface
Définir les règles d’utilisation et la composition
Fournir des wireframes et créer des exercices à réaliser seul ou en équipe à partir de ces derniers :
Créer un menu de navigation
Créer des composants
Faire la maquette d’une page à partir d’un wireframe
Réaliser un kit UI à l’aide des éléments UI de la maquette
Prototyper les maquettes en créant des liens cohérents entre chacune d’entre elles
Créer des éléments d’interaction et d’animation au sein des maquettes', 40.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DES_TS-07')) and e.ordre = 4), 'D.2', 'Prototyper les maquettes', 'Création des liens entre les maquettes permettant l’élaboration de la maquette
Automatisation des éléments cliquables sur le prototype de la maquette
Gestion des éléments d’animation du prototype', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 8, 'DIA_DESOUX_TS-08', 'M108', 'S’initier à la création et l’utilisation d’interactions digitales', 105, 'tronc_commun')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08'), 'Individuellement ou en équipe
À partir :
De spécificités techniques
À l’aide :
De wireframes
Du cahier des charges
De documentation sur les utilisateurs
D’outils de prototypage', 'Choix judicieux du logiciel a utiliser en fonction de l’interaction
Connaissance des différents types d’interactions
Capacité à choisir des interactions en fonction des utilisateurs
Respect des règles de navigation
Hiérarchie précise des types d’interactions
Cohérence avec les attentes utilisateurs
Gestion cohérente des informations
Cohérence avec les besoins du projet
Respect des règles d’accessibilité')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')), 'A', 'Comprendre les interactions entre l’interface et l’utilisateur', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 1), 'Différenciation juste animation et interaction', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 1), 'Connaissance adéquate des différents types d’interactions', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 1), 'Connaissances spécifiques des différents navigateurs', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 1), 'Appréhension correcte des types d’interactions d’un utilisateur', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 1), 'A.1', 'Définir une interaction d’interface utilisateur', 'Définition de la notion d’interaction entre l’interface et l’utilisateur
Différence entre animation et interaction digitale
Utilisation des interactions selon le contexte de l’interface digitale
Typologies d’interactions (interactions directes comme des boutons, interactions indirectes, micro intéractions)', 'Seul
À partir de spécificités techniques
A l’aide d’un logiciel de prototypage (Figma, Adobe XD), de documents techniques', 25.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 1), 'A.2', 'Connaitre les spécificités des types d’interactions', 'Propriétés des formats (format des fichiers sources, formats d’export en contenu statique et dynamique)
Différence entre interactions principales et secondaires (prioriser certaines interactions)
Écosystèmes digitaux dans lesquels se retrouve les interactions', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 1), 'A.3', 'Spécifier le comportement de l’interaction selon le support digital', 'Identification de l’ergonomie des interfaces digitales (desktop, smartphone)
Niveau d’interaction entre l’utilisateur et l’interface adapté au support digital
Modélisation des interactions', null, null, 3)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')), 'B', 'Définir les états et niveaux d’interactions dans des interfaces digitales', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 2), 'Définition claire des actions prioritaires', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 2), 'Indication juste de tous les types d’interaction', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 2), 'Hiérarchie logique des interactions', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 2), 'Cohérence appropriée avec l’utilisation de l’interface', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 2), 'B.1', 'Connaitre les outils d’interaction du logiciel', 'Identification des différents outils permettant de créer des interactions
Choix pertinent des outils de création d’interactions
Cas d’usage de solutions web et digitales qui présentent des interactions entre l’interface et l’utilisateur', 'Seul ou en équipe
À partir de spécificités techniques
A l’aide d’un logiciel d’animation, de documents techniques
Rechercher des solutions digitales avec des interactions
Rédiger une analyse de ces dernières
Avec un brief, créer des assets d’interactions pertinents', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 2), 'B.2', 'Lier la technique à la production d’éléments pour un projet', 'Définition des caractéristiques des interactions : déclencheurs, durée, règles, feedback, boucles et modes
Intégration des concepts UX/UI dans la réalisation d’interactions', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')), 'C', 'Transmettre des assets cohérents', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'Placement pertinent des interactions', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'Identification claire du lien entre storytelling et interactions', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'Cohérence entre les interactions et les parcours utilisateurs', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'Mesures correctives adaptées en fonction de tests réalisés', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'Création facile d’assets pour le développeur', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'Indications claires et précises sur la mise en forme', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'Communication appropriée aux langages des développeurs', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'Transmission complète des informations', 8)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'C.1', 'Créer des assets pertinents en fonction de l’utilisation de l’interaction sur l’interface', 'Compréhension des contraintes de développement des interactions
Placement des interactions sur l’interface
Export des assets pour l’intégration des interactions
Utilisation du motion design pour transmettre les indications d’interactions
Cohérence entre les interactions, leur placement et le parcours utilisateur', 'Seul ou en équipe
À partir du cahier des charges et du cahier des spécifications techniques
A l’aide d’un logiciel d’animation, de spécifications techniques
À partir de spécificités techniques
A l’aide du cahier des spécifications techniques
Créer un document à destination de développeur
Échanger avec des développeurs sur leurs attentes et besoins
Créer un petit projet en collaboration avec les apprenants de la formation de développement front-end', 45.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-08')) and e.ordre = 3), 'C.2', 'Transmettre les assets et informations aux développeurs', 'Document d’indication et de spécifications techniques sur le comportement des interactions sur l’interface
Export d’assets pour l’intégration web des interactions sur l’interface', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 9, 'DIA_DESOUX_TS-09', 'M109', 'S’initier à la gestion de projet', 30, 'specialisation')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09'), 'Individuellement et / ou en groupe
À partir :
De mises en situations écrites et orales
De consignes
De base documentaire
De spécifications fonctionnelles
De spécifications techniques
À l’aide :
De logiciels de gestion de projet', 'Bonne connaissance des fondamentaux de la gestion de projet
Rédaction facile de diagramme des cas d''utilisation
Bonne compréhension de l''approche itérative et incrémentale
Application facile des méthodes Agile')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')), 'A', 'S’initier à la gestion de projet', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 1), 'Formalisation facile des exigences', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 1), 'Priorisation correcte des "User Stories"', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 1), 'Rédaction facile de diagramme de cas d’utilisation', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 1), 'A.1', 'Formaliser des exigences', 'User story
Diagramme de cas d’utilisation
Cahier des charges
Chiffrage', 'Seul ou en groupe
Selon les instructions verbales ou écrites du formateur
À l’aide des supports fournis par le formateur (polycop, documents, cours)
QCM sur les différentes méthodes de définitions des besoins
Travaux pratiques :
Création de diagramme de PERT
Création de diagramme de GANT', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 1), 'A.2', 'Prioriser des "User Stories"', 'Itérations du projet
Diagramme de Pert
Diagramme de Gantt', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')), 'B', 'Appliquer les méthodes Agile', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 2), 'Maitrise des clés du management de l''équipe Agile', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 2), 'Mise en œuvre facile de la Méthode SCRUM', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 2), 'Mise en œuvre facile de la Méthode SAFE', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 2), 'B.1', 'Appliquer la méthode SCRUM', 'Rôles en agile : le Product Owner, le Scrum Master, l''équipe de développement, le testeur, le tracker, le coach
Sprints ou les itérations du projet
Planification journalière : daily scrum ou standing meeting : l''objectif, l''organisation.
Planning Poker', 'Seul ou en groupe
Selon les instructions verbales ou écrites du formateur
À l’aide des supports fournis par le formateur (polycop, documents, cours)
QCM sur Scrum et SAFE
Travaux pratiques :
Jeu de rôle sur les différentes responsabilités intervenant au sein des projets agiles
Elaborer un backlog de sprint
Découpage des stories en tâches Planification d''un sprint
Mise en situation Daily Scrum
Elaboration de trains de release agile', 70.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-09')) and e.ordre = 2), 'B.2', 'Appliquer la méthode SAFE', 'Portefeuille SAFE
Trains de release agile (ART)
Planification des itérations
Organisation de travail avec les autres équipes dans le train', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 10, 'DIA_DESOUX_TS-10', 'M110', 'Analyser les besoins des utilisateurs', 90, 'specialisation')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10'), 'En équipe
À partir :
De consignes
De mise en situations écrites et orales
De condition techniques
À l’aide :
De données chiffrées
De documentation sur les utilisateurs
D’outils d’enregistrements comportementaux
D’outils de collectes de données', 'Recueil complet des données à disposition
Analyse pertinente des données en fonction du projet
Manifestation d’empathie
Priorisation fonctionnelle et cohérente
Anticipation des besoins')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')), 'A', 'Collecter des données', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 1), 'Utilisation pertinente d’outils de collecte de données', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 1), 'Respect de la séquence d’opérations', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 1), 'Reformulation compréhensible de données chiffrées', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 1), 'Audit complet des ressources à disposition', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 1), 'A.1', 'Réaliser un travail de recherche', 'Analyse de la cibe et de la solution
Audit des first party data
Recherches sur les utilisateurs
Outils d’organisation à la collecte de données', 'Seul
À partir de mises en situations écrites et orales
Travaux pratiques : À l’aide de documents sur la marque et la solution, d’outils de collecte de données et d’outils d’édition de texte
Choix d’un sujet documenté par l’intervenant
Analyse des comportements grâce à des outils
Analyse en groupe de données
Mise en place de focus group', 15.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 1), 'A.2', 'Mettre en forme les données recueillies', 'Tri et synthèse des données recueillies
Hiérarchisation des données reccueillies', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')), 'B', 'Analyser les données utilisateurs', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 2), 'Description détaillée des comportements d’utilisations', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 2), 'Catégorisation des utilisateurs', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 2), 'Convergence entre les données', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 2), 'Manifestation d’empathie', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 2), 'Définition d’un lien entre les utilisateurs et l’entreprise', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 2), 'B.1', 'Organiser les données utilisateurs', 'Catégorisation des utilisateurs
Classification des types d’utilisateurs potentiels de la solution digitale', 'Seul ou en équipe selon instructions du formateur
A partir de consignes et de données
Travaux pratiques : A l’aide d’outils d’analyse comportementale et de documents de cours fournis par le formateur
Préciser des séquences d’opération
Analyse de données en groupe
Faire tirer des conclusions
Conclure avec la classe', 25.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 2), 'B.2', 'Interpréter les données', 'Analyse des habitudes et patterns utilisateurs
Cartographie des comportements utilisateurs
Exercices pratiques empathiques', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')), 'C', 'Identifier les points d’amélioration des données', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 3), 'Attitude empathique', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 3), 'Appréhension juste des utilisateurs', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 3), 'Identification complète des points bloquants', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 3), 'Anticipation logique des frustrations', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 3), 'Spécification précise des motivations', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 3), 'Priorisation des actions à entreprendre', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 3), 'C.1', 'Relever les points bloquants', 'Méthodes de tests / d’interview / de sondage
Analyse d’une solution existante
Analyse de parcours utilisateurs possibles', 'Seul ou en équipe selon instructions du formateur
À partir d’études de cas, de méthodologies, de documents professionnels, de synthèse de données
A l’aide de documentation projet, d’outils de mise en forme
Ateliers d’idéation et de convergence
Cartographie des comportements
Priorisation et roadmap', 20.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 3), 'C.2', 'Trouver des solutions techniques', 'Méthodes de design émotionnel
Identification des motivations et points bloquants
Roadmap d’optimisations', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')), 'D', 'Documenter les utilisations', 4)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 4), 'Fiche persona complète', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 4), 'Délimitation précise des attentes et besoins', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 4), 'Associations correctes entre utilisateurs et besoins', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 4), 'Interprétation cohérente des utilisations', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 4), 'Respect de la séquence des opérations', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 4), 'Application correcte des méthodes d’identification', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 4), 'Manifestation d’empathie', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 4), 'D.1', 'Créer des personas', 'Identification et création de fiches persona complètes
Identification des parcours principaux
Créations d’empathy maps pour chaque persona', 'Seul ou en équipe selon instructions du formateur
A partir d’un cahier des charges ou de données sur le projet
A l’aide de recherches internet, d’outil de mise en forme et de méthodologies
Création de fiches personas, empathy maps et user journey maps', 40.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-10')) and e.ordre = 4), 'D.2', 'Réaliser des user journeys', 'Identification des grandes étapes de navigation
Relève des ressentis des personas
Axes d’améliorations pour anticipation des points à risque', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 11, 'DIA_DESOUX_TS-11', 'M111', 'Déterminer les parcours utilisateurs', 105, 'specialisation')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11'), 'Individuellement puis en équipe
À partir :
De données sur les utilisateurs
À l’aide :
De fiches personas
D’études de cas', 'Production utile de users story et de scénario d’usage
Conception d’empathy maps cohérentes avec les personnas
Empathie constante
Utilisation pertinente des outils de mapping')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')), 'A', 'Traduire les besoins des utilisateurs', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 1), 'Solution technique à des besoins utilisateurs', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 1), 'Mise en place d’un objectif cohérent', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 1), 'Enquête contextuelle efficace', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 1), 'Réponse aux attentes claire', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 1), 'A.1', 'Identifier les besoins des utilisateurs', 'Enquête contextuelle des besoins actuels
Identification des points d’amélioration
Liste de attentes principales des utilisateurs', 'Seul
À partir de mises en situations écrites et orales, de données utilisateurs
À l’aide de documents sur la marque et la solution, de fiches personas, d’habitudes d’utilisation
Analyser l’existant de la solution digitale
Identifier les besoins et/ou axes d’amélioration
Lister les attentes et objectifs UX du projet
Créer des objectifs SMART
Proposer des solutions techniques', 15.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 1), 'A.2', 'Définir des objectifs attendus face aux besoins', 'Objectifs identifiés conformément aux besoins
Solutions techniques répondant aux besoins', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')), 'B', 'Cartographier l’expérience utilisateur', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 2), 'Scénario d’usage réaliste', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 2), 'Logique de la suite d’étape de l’expérience utilisateur', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 2), 'Décomposition adéquate des phases mises en place', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 2), 'Cohérence entre les phases et l’objectif du parcours', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 2), 'B.1', 'Réaliser des scénarios d’usage', 'Liste d’utilisations principales de la solution digitale
Mise en valeur de scénarios de navigations principales', 'Seul
À partir de mises en situations écrites et orales, de données utilisateurs
À l’aide de documents sur la marque et la solution, de fiches personas, d’habitudes d’utilisation
Exemples de cas professionnels
Ateliers en groupe : scénarios d’usage, expérience maps', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 2), 'B.2', 'Réaliser des expérience maps', 'Utilisation des maps d’expérience
Mise en valeur des étapes de navigation majeures
Relève des points bloquants de l’expérience utilisateur', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')), 'C', 'Définir les parcours principaux des utilisateurs', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 3), 'Définition du périmètre du projet', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 3), 'Identification de toutes les interactions possibles', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 3), 'User flow cohérent avec le contexte', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 3), 'Respect des habitudes d’utilisation', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 3), 'C.1', 'Identifier les parcours principaux', 'Scénario de visite dans le parcours
Utilisation des user flows
Liste d’objectifs de navigation
Etapes répondant aux besoins identifiés', 'Seul
À partir de mises en situations écrites et orales, de données utilisateurs
À l’aide de documents sur la marque et la solution, de fiches personas, d’habitudes d’utilisation
Utiliser les exercices des ateliers précédents
Ateliers en groupe : parcours utilisateurs, user flows, arborescence', 40.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 3), 'C.2', 'Cartographier l’expérience utilisateurs', 'Modélisation des parcours par besoin et par utilisateiur
Cartographie des parcours utilisateurs centraux et secondaires', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')), 'D', 'Spécifier les opportunités du parcours utilisateur', 4)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 4), 'Liste complète des points de contact', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 4), 'Identification des zones de risques du parcours', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 4), 'Simplicité des actions réalisées', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 4), 'D.1', 'Tester les parcours utilisateurs', 'Réalisation de user flows
Test des parcours utilisateurs
Tests de trouvabilité et d’affordance', 'Seul ou en équipe selon instructions du formateur
A partir d’un cahier des charges ou de données sur le projet
A l’aide de parcours utilisateurs
Tester tous les parcours
Lister les problèmes rencontrés
Lister les potentiels points bloquants
Détailler les améliorations possibles
Itérer', 15.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-11')) and e.ordre = 4), 'D.2', 'Améliorer les parcours après analyse', 'Identifications des points de contact
Relève des zones de risque et proposition d’amélioration', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 12, 'DIA_DESOUX_TS-12', 'M112', 'Connaître les spécificités de l’ergonomie de différents types de solutions', 75, 'specialisation')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12'), 'Individuellement
À partir :
De consignes
À l’aide :
De documentation sur l’ergonomie
D’indications sur les habitudes d’utilisation
De documentation sur les interfaces digitales', 'Connaissances abouties des types d’interfaces
Compréhension des utilisations des interfaces
Analyse rigoureuse des besoins des utilisateurs en fonction de l’interface
Respect des normes digitales')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')), 'A', 'Identifier les différents types d’interface', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 1), 'Connaissances globales des spécificités des interfaces', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 1), 'Assimilation des comportements utilisateurs en fonction des types d’interfaces', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 1), 'Respect des habitudes et bonnes pratiques', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 1), 'Utilisation du bon type de logiciel en fonction de l’interface', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 1), 'A.1', 'Connaitre les spécificités des interfaces', 'Différenciation des interfaces de solutions digitales
Mobile
Tablette
Desktop
Télé
Tactile, etc
Spécifications techniques selon le support de la solution digitale
Études des comportements utilisateurs', 'Seul
A partir de documentation fournie par le formateur
A l’aide de logiciel de maquettage et de prototypage
Etude de cas comme Netflix par exemple, avec une utilisation mobile, tablette, desktop, télévision
Pour chaque interface, citer les éléments ergonomiques, spécificités et conventions à prendre en compte', 15.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')), 'B', 'Adapter sa production aux interfaces', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 2), 'Respect des comportements des éléments', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 2), 'Respect des break points', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 2), 'Adaptabilité des productions de wireframes', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 2), 'Adaptabilité à l’environnement technique', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 2), 'B.1', 'Détailler les interfaces de production', 'Indication des breakpoints selon les points d’ergonomie à prendre en compte
Utilisation des conventions liées à chaque type d’interface
Modélisation des processus (processus d''inscription, le processus de commande, les process transactionnels, etc)', 'Seul ou en équipe
A partir d’études de cas, de consignes et de documentation fournie par le formateur
A l’aide de logiciel de maquettage et de prototypage, d’analyses d’interfaces, de veille technique et graphique
Réaliser des wireframes
Réaliser une veille d’interfaces après un cours théorique
Décliner les wireframe à une ou plusieurs interfaces selon les indications du formateur', 50.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 2), 'B.2', 'Décliner la production en fonction des exigences de l’interface', 'Production de wireframes
Adaptation des breakpoints
Changement des comportements des éléments', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')), 'C', 'Appréhender les principes d’utilisation des supports', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 3), 'Respect de l’ergonomie des supports', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 3), 'Appréhension logique des interactions propres au support', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 3), 'Application correcte des méthodes de travail', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 3), 'Respect des normes digitales', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 3), 'C.1', 'Connaitre les règles d’ergonomie des interfaces selon le support', 'Connaissances des particularités de chaque type d’interface
Test de la solution digitale
Recommandations ergonomiques', 'Seul
A partir de wireframes et de documentation
A l’aide de logiciels de maquettage et de prototypage
Reprendre les wireframes de l’exercice précédent
Continuer l’exercice en y intégrant la notion d’interaction
Créer des composants
Récupérer des productions d’UI Design afin de pousser l’exercice plus loin', 35.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-12')) and e.ordre = 3), 'C.2', 'Gérer les interactions de la solution digitale', 'Adaptation des composants à l’interface
Utilisabilité de l’interface
Respect des normes digitales', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 13, 'DIA_DESOUX_TS-13', 'M113', 'Créer un design d’interfaces ergonomique et interactif', 60, 'specialisation')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13'), 'Individuellement
À partir :
De cahier des charges
De consignes techniques
À l’aide :
De logiciels de maquettage
D’indications des spécificités', 'Organisation cohérente du contenu
Utilisation judicieuse des logiciels de wireframing
Respect des utilisateurs
Positionnements adaptés
Déclinaisons cohérentes des wireframes
Respect des règles d’accessibilité
Respect des conventions du web')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')), 'A', 'Organiser le contenu de la solution digitale', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 1), 'Catégorisation pertinente du contenu', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 1), 'Placement des éléments dans les catégories adéquates', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 1), 'Priorisation des contenus en adéquation avec les besoins du projet', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 1), 'Respect des demandes client', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 1), 'A.1', 'Utiliser les résultats de la recherche UX', 'Utilisation des personas, empathy maps et user journey maps pour tirer des conclusions
Création des parcours d’utilisation de la solution digitale', 'En équipe
A partir du cahier des charges
A l’aide d’ateliers, de données sur le client et son besoin
Créer les parcours d’utilisation
Lister les contenus
Réaliser des ateliers de tri par cartes pour les fonctionnalités
Réaliser des ateliers de tri par cartes pour les catégories et le contenu
Prioriser le contenu à l’aide de gommettes', 15.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 1), 'A.2', 'Catégoriser le contenu des pages', 'Ateliers de tri par cartes
Création de catégories de contenus pertinentes', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')), 'B', 'Positionner le contenu de la solution digitale', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 2), 'Placement pertinent des éléments', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 2), 'Respect des spécifications de priorisation', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 2), 'Utilisation judicieuse des outils de maquettage', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 2), 'B.1', 'Organiser les contenus dans les pages', 'Placement et Priorisation des éléments de contenus dans les pages
Positionnement des blocs de contenus et des CTA
Hiérarchie du contenu', 'Seul ou en équipe
A partir du cahier des charges
A l’aide d’ateliers, de données sur le client et son besoin, des contenus et de logiciel de maquettage
Peut se réaliser d’abord sous forme d’ateliers de fast wireframing sur papier
Échanges sur les wireframes papiers produits et
Réaliser ensuite les wireframes au format digital', 45.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 2), 'B.2', 'Créer des wireframes', 'Inventaire fonctionnel des wireframes
Création de zonings définissant les grandes zones de l’interface
Utilisation de documents de conception fonctionnelle
Création des wireframes pour chacune des pages', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')), 'C', 'Décliner les productions des contenus', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 3), 'Wireframes adaptés à l’interface', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 3), 'Respect des normes de chaque interface', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 3), 'Adaptabilité du contenu', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 3), 'Prise en compte de l’ergonomie propre aux interfaces', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 3), 'C.1', 'Analyser les différents types d’interfaces de la solution', 'Définition des normes des interfaces de la solution digitale
Compatibilité des contenus de l’interface avec les technologies du web
Vérification des règles d’accessibilité', 'Seul ou en équipe
A partir du cahier des charges
A l’aide des wireframes et de logiciel de maquettage
Définir les interfaces sur lesquelles décliner les wireframes
Décliner les wireframes sur différents types d’interfaces
Tests d’utilisabilité', 20.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 3), 'C.2', 'Décliner les wireframes', 'Utilisabilité des wireframes
Adaptabilité du contenu à la solution digitale
Respect de l’ergonomie de l’interface', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')), 'D', 'Rendre l’interface interactive', 4)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 4), 'Placement correct des interactions', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 4), 'Choix judicieux des types d’interactions', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 4), 'Lien logique entre le storytelling et les interactions', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 4), 'Bonne coordination entre les espaces de navigation', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 4), 'Interactions adaptées aux parcours utilisateurs', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 4), 'D.1', 'Placer les interactions dans l’interface', 'Choix du bon type d’interaction
Production de wireflows
Positionnement des interactions sur les maquettes / prototypes
Interactions adaptées aux parcours utilisateurs
Test des parcours utilisateurs', 'Seul ou en équipe
A partir du cahier des charges
A l’aide des wireframes, de logiciel de prototypage, d’outils de collaboratoin avec les développeurs
Placer les interactions sur les wireframes
Paramétrer et organiser les types d’interactions
Tester le prototype en vérifiant les feedback lors de chaque action de l’utilisateur
Créer un fichier propre pouvant être livré à des développeurs', 20.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-13')) and e.ordre = 4), 'D.2', 'Soumettre les indications d’interaction', 'Transmission des indications nécéssaires à l’intégration des interactions
Diffusion des éléments d’interaction aux développeurs', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 14, 'DIA_DESOUX_TS-14', 'M114', 'Architecturer des informations', 60, 'specialisation')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14'), 'En équipe
À partir :
De contenu textuel
D’indications du client
À l’aide :
Du cahier des charges
De documents sur le contenu
D’outils de réalisation de schéma et cartes
D’outil de création de formes
Des personas', 'Respect des spécifications de contenu
Respect des besoins des utilisateurs
Tri pertinent des informations
Organisation adéquate du contenu
Priorisation pertinente des contenus
Respect des règles de trouvabilité')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')), 'A', 'Classifier l’information', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 1), 'Utilisation pertinente de la méthode de tri de cartes', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 1), 'Définition complète des catégories', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 1), 'Tri pertinent des informations', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 1), 'Lien logique entre les contenus et les personas', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 1), 'A.1', 'Préparer la stratégie de contenus', 'Recherches sur les utilisateurs cibles
Ciblage des contenus selon les besoins et contraintes du projet', 'Seul
Du cahier des charges et du contenu de la solution
De documents sur le contenu
D’outils de réalisation de schémas et cartes et des personas', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 1), 'A.2', 'Organiser les informations', 'Inventaire des contenus
Formalisations des idées concernant le contenu et la structuraiton
Identification des problèmes à résoudre', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')), 'B', 'Prioriser l’information', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 2), 'Distinction pertinente des contenus et fonctionnalités', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 2), 'Lien tangible entre les contenus et les besoins utilisateurs', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 2), 'Utilisation pertinente de la méthode statistique', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 2), 'Identification juste des récurrences', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 2), 'Hiérarchie adéquate des contenus', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 2), 'B.1', 'Définir les fonctions du contenus', 'Tri des informations
Méthode statistique', 'Seul
Du cahier des charges et du contenu de la solution
De documents sur le contenu
D’outils de réalisation de schémas et cartes et des personas', 25.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 2), 'B.2', 'Catégoriser les contenus', null, null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')), 'C', 'Structurer l’information', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 3), 'Structure efficace des catégories de la solution', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 3), 'Répartition logique des contenus', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 3), 'Respect de la trouvabilité en fonction des besoins', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 3), 'Utilisabilité fonctionnelle en lien avec les personas', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 3), 'C.1', 'Organiser les contenus', 'Réponse aux besoins des utilisateurs
Utilisation de la priorisation
Placement logique des informations', 'Seul
A partir du cahier des charges et du contenu de la solution
A l’aide de documents sur le contenu et des wireframes,effectuer les manipulations suivantes :
Placement logique des informations
Trouvabilité
Lien avec les personas', 45.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-14')) and e.ordre = 3), 'C.2', 'Placer les information dans les premiers zonings', 'Repérage des informations classifiées
Placement des informations dans le zoning', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 15, 'DIA_DESOUX_TS-15', 'M115', 'Réaliser des tests utilisateurs', 90, 'specialisation')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ((select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15'), 'En équipe
À partir :
De brief
De consignes
À l’aide :
De documents d’organisation
Des Prototypes', 'Respect des séquences de tests
Esprit de synthèse
Cohérence du déroulement des tests
Synthétisation complète et claire
Mise en valeur adéquate des points d’amélioration
Actions correctives répondant à des problèmes donnés
Lien logique entre besoin et solution')
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')), 'A', 'Préparer les phases de test', 1)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 1), 'Logistique précise de recrutement de testeurs', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 1), 'Choix judicieux des testeurs', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 1), 'Vérification approfondie du matériel de test', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 1), 'Planification efficace du déroulement des tests', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 1), 'Anticipation efficace des points clés à évaluer', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 1), 'A.1', 'Recruter les testeurs', 'Mise en place de la logistique
Adéquation du panel représentatif des utilisateurs finaux', 'Seul ou en équipe
Du cahier des charges et du prototype
A l’aide d’outils d’enregistrement et de méthodes de réalisation de tests utilisateurs
Choisir les types de tests à réaliser
Recruter les participants
Préparer les tests', 30.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 1), 'A.2', 'Préparer le test', 'Planification du déroulement
Gestion du matériel nécessaire au test
Préparation des points à anticiper', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')), 'B', 'Réaliser les tests', 2)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'Analyse en temps réel précise', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'Retranscription complète des informations perçues', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'Manifestation d’empathie', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'Respect des règles de tests utilisateurs', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'Préparation complète des outils d’enregistrement', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'Organisation efficace des résultats des tests', 6)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'Analyse pertinente des résultats des tests', 7)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'Rigueur dans l’écoute et la visualisation des enregistrements', 8)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'Mise en valeur des points à améliorer', 9)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'B.1', 'Analyser les résultats du test', 'Retranscription précise des données auditives et visuelles
Condition d’exécution des tests sans interactions avec les testeurs durant le test
Paramétrage des outils d’enregistrement des tests', 'Seul ou en équipe
Du cahier des charges et du prototype
A l’aide d’outils d’enregistrement, de méthodes de réalisation de tests utilisateurs et des résultats du test
Réaliser les tests
Analyser les comportements utilisateurs en temps réels
Analyser les données receuillies
Synthéthiser les résultats obtenus', 45.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 2), 'B.2', 'Retranscrire les données du test', 'Hiérarchisation des résultats
Analyse des enregistrements
Conclusions tirées des tests
Liste de points d’amélioration', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ((select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')), 'D', 'Effectuer des actions correctives', 3)
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 3), 'Compréhension logique des points d’amélioration', 1)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 3), 'Planification efficace des actions à mener', 2)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 3), 'Résolution adéquate des problèmes soulevés', 3)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 3), 'Maitrise des méthodes de modification de wireframes', 4)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 3), 'Respect des règles d’utilisation de la solution', 5)
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 3), 'D.1', 'Exploiter les conclusions des tests', 'Analyse des points d’amélioration
Liste des tâches à effectuer et productions à revoir
Mise en place de solutions aux problématiques
Mise en œuvre d’une planification des phases d’amélioration', 'Seul ou en équipe
Du cahier des charges, du prototype et des wireframes
A l’aide de logiciels de maquettage et de prototypage
Tirer des conclusions des tests
Proposer des axes d’amélioration
Trouver des solutions aux problèmes soulevés
Planifier les phases d’itération à venir
Améliorer la solution en fonction des retours et étapes à suivre', 25.0, 1)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;
insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ((select e.id from public.elements_competence e where e.fiche_prescrite_id = (select f.id from public.fiches_prescrites f where f.competence_id = (select id from public.competences where code_officiel = 'DIA_DESOUX_TS-15')) and e.ordre = 3), 'D.2', 'Améliorer la solution', 'Reprise des wireframes
Respect de la planification selon les indications des résultats des tests
Règles d’utilisation de la solution', null, null, 2)
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;

insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ((select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id where s.code = 'DIA_DES_TS' and p.annee_approbation = 2021), 16, 'DIA_DESOUX_TS-16', 'M116', 'S''intégrer en milieu professionnel', 160, 'specialisation')
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);
-- Compétence 16 : aucune fiche prescrite dans le document.

