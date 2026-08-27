-- informations-generales-competence-06.sql — Atome 2b.1b
--
-- Énoncé de la compétence et description générale du cours, relevés dans le
-- manuel de formateur officiel de la compétence 6 fourni par le formateur
-- (manuel-formateur-digital-design-m106, page 4).
--
-- L'énoncé suit une formule constante d'une compétence à l'autre ; il est
-- néanmoins recopié tel quel plutôt que reconstruit, pour ne pas inventer une
-- formulation officielle. La description générale, elle, est propre à la
-- compétence et ne se déduit de rien.
--
-- Idempotent : rejouable sans écraser une saisie ultérieure du formateur.

update public.competences
set
  enonce_competence = coalesce(enonce_competence,
    'Pour démontrer sa compétence, le stagiaire doit savoir déterminer les concepts de l''UX / UI Design selon les conditions, les critères et les précisions qui suivent.'),
  description_generale = coalesce(description_generale,
    'Chaque produit/solution numérique a ses propres spécificités, sa cible, son comportement. Une bonne compréhension de ses caractéristiques aidera les clients/utilisateurs à répondre à leurs besoins, afin d''aider l''entreprise à atteindre ses objectifs commerciaux.

Le rôle principal de cette compétence est de donner aux stagiaires une base solide du concept d''UX/UI Design et de bien comprendre les étapes à suivre, les lois et les règles pour créer un produit/solution numérique qui répond exactement aux besoins des utilisateurs/clients.

L''organisation du cours place cette compétence au début de la première année due à sa pertinence et son importance comme base des compétences qui suivent.')
where numero = 6;
