-- 103_copies_a_corriger.sql — savoir qu'une copie attend, sans la transporter
-- (audit CPU du 26 septembre 2026, correction 2)
--
-- La cloche du formateur demandait `responses` — la copie entière — pour les
-- quarante dernières passations, afin de tester une seule chose : reste-t-il
-- une question non notée ? Mesuré : 11,7 Ko par copie, 343 Ko à chaque
-- vérification, analysés puis jetés.
--
-- Le test se fait mieux là où sont les données. La vue applique exactement la
-- règle du code qu'elle remplace : une copie est en attente si au moins une
-- de ses réponses n'a pas de points — clé absente ou valeur nulle.
--
-- `security_invoker = on` : la vue lit sous l'identité de l'appelant, donc
-- les politiques de `passations_controle` s'appliquent comme avant. Sans
-- cela, une vue s'exécuterait avec les droits de son propriétaire et
-- ouvrirait à tous les copies de tout le monde.

create or replace view public.v_copies_a_corriger
with (security_invoker = on) as
select
  p.id,
  p.controle_id,
  p.stagiaire_id,
  p.nom_complet,
  p.submitted_at
from public.passations_controle p
where exists (
  select 1
  from jsonb_array_elements(coalesce(p.responses, '[]'::jsonb)) as e
  where e -> 'points' is null
     or jsonb_typeof(e -> 'points') = 'null'
);

comment on view public.v_copies_a_corriger is
  'Copies dont au moins une question n''est pas notée. Évite de transporter le JSON des copies pour une question à laquelle Postgres répond en une ligne.';
