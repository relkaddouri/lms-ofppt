-- Calibration pédagogique du barème (PRD §4.7).
--
-- Deux règles que la génération ne portait pas : le barème d'une question doit
-- suivre sa difficulté réelle — une question de raisonnement à plusieurs
-- étapes vaut nettement plus qu'une restitution directe — et le modèle doit
-- justifier ce choix ; et la courbe de difficulté doit viser 60 % du total sur
-- un socle accessible à toute la classe contre 40 % de questions
-- discriminantes.
--
-- Les deux se stockent plutôt que de vivre le temps d'une réponse : la
-- justification sert au moment de la relecture, c'est-à-dire après un
-- rechargement, et le niveau permet de vérifier la courbe à tout moment —
-- y compris sur un contrôle repris d'une année sur l'autre (§4.15).

alter table public.questions_controle
  add column if not exists difficulte text,
  add column if not exists justification_bareme text;

alter table public.questions_controle
  drop constraint if exists questions_controle_difficulte_check;
alter table public.questions_controle
  add constraint questions_controle_difficulte_check
  check (difficulte is null or difficulte in ('accessible', 'discriminant'));

comment on column public.questions_controle.difficulte is
  'Place de la question dans la courbe : « accessible » pour le socle que '
  'toute la classe doit atteindre, « discriminant » pour ce qui distingue les '
  'meilleurs. Null sur une question saisie à la main sans calibration.';
comment on column public.questions_controle.justification_bareme is
  'Pourquoi ce nombre de points correspond à la difficulté de la question. '
  'Écrit par le modèle à la génération, relu et modifiable par le formateur.';
