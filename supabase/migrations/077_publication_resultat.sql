-- Publication manuelle du résultat d'un contrôle (PRD §4.7).
--
-- Après avoir remis sa copie, le stagiaire ne voyait rien venir : il voyait sa
-- note, calculée par le serveur au moment de la remise. Le PRD tranche
-- autrement, sur le modèle du partage de la grille de correction de TP — le
-- résultat n'apparaît que lorsque le formateur le publie, après avoir relu la
-- correction.
--
-- La difficulté tient à ce que le stagiaire doit continuer à savoir qu'il a
-- rendu. Masquer la ligne entière lui ferait croire que sa copie s'est perdue,
-- ce qui est pire que de le faire attendre.

alter table public.passations_controle
  add column if not exists publie_le timestamptz;

comment on column public.passations_controle.publie_le is
  'Date à laquelle le formateur a publié le résultat au stagiaire (PRD §4.7). NULL tant qu''il ne l''a pas fait : la note existe alors côté serveur mais reste invisible.';

-- ── Lecture stagiaire : la note n'existe qu'une fois publiée ──────────────
--
-- La condition vit dans la policy et non dans l'écran. Une note masquée
-- seulement à l'affichage reste lisible par quiconque interroge l'API avec le
-- jeton du stagiaire — c'est exactement la mise en garde du §4.7 sur le
-- corrigé « jamais exposé côté client ».

drop policy if exists "passations_lecture_stagiaire" on public.passations_controle;
create policy "passations_lecture_stagiaire" on public.passations_controle
  for select to authenticated
  using (
    publie_le is not null
    and stagiaire_id in (
      select s.id from public.stagiaires s where s.user_id = auth.uid()
    )
  );

-- ── Ce que le stagiaire voit malgré tout : qu'il a rendu ──────────────────
--
-- `security definer` parce que la policy ci-dessus lui ferme désormais la
-- table. La vue ne rend que le fait et sa date, jamais la note ni les
-- réponses, et son `where` la restreint aux copies de l'appelant : elle ouvre
-- une fenêtre, pas la porte.

create or replace view public.v_mes_remises
with (security_invoker = false)
as
select
  p.id,
  p.controle_id,
  p.stagiaire_id,
  p.submitted_at,
  (p.publie_le is not null) as resultat_publie
from public.passations_controle p
where p.stagiaire_id in (
  select s.id from public.stagiaires s where s.user_id = auth.uid()
);

comment on view public.v_mes_remises is
  'Preuve de remise d''une copie, sans la note : le stagiaire sait qu''il a rendu et si le résultat est publié, rien de plus (PRD §4.7).';

grant select on public.v_mes_remises to authenticated;
