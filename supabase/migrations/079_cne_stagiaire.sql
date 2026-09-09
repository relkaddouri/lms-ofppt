-- Le CNE du stagiaire, à côté de son CEF (PRD §4.7).
--
-- Deux identifiants, deux administrations. Le CEF est le code
-- d'enregistrement du formé, propre à l'OFPPT : c'est lui qui sert à se
-- connecter et à nommer les documents. Le CNE est le code national de
-- l'étudiant, que réclament les pièces qui sortent de l'établissement.
--
-- Il s'ajoute donc, il ne remplace pas. Nul par défaut : aucune fiche
-- existante n'en porte, et un identifiant national ne s'invente pas.
--
-- Pas de contrainte d'unicité, contrairement au CEF : le CNE est saisi à la
-- main depuis un document papier, et un doublon dû à une faute de frappe
-- bloquerait l'enregistrement d'une fiche sans dire laquelle est fautive.
-- Mieux vaut un doublon visible qu'une saisie impossible.

alter table public.stagiaires
  add column if not exists cne text;

comment on column public.stagiaires.cne is
  'Code National de l''Étudiant. Distinct du CEF, qui reste l''identifiant OFPPT (PRD §4.7).';
