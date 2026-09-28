-- 105_partage_quiz_stagiaire.sql — le quiz d'un chapitre partagé se lit aussi
-- (§4.3bis et §4.5bis, suite du correctif 104)
--
-- Même angle mort que pour le support : la lecture du quiz exige que la
-- séance du support soit dans le groupe du stagiaire. Quand sa séance est un
-- miroir, le support — donc le quiz — est porté par la séance de l'autre
-- groupe, et le bouton « Testez-vous » ne rendait rien.
--
-- Le quiz suit le contenu : deux groupes qui lisent le même chapitre révisent
-- sur les mêmes questions, ce qui est exactement l'intention du partage.

drop policy if exists "quiz_chapitre_lecture" on public.quiz_chapitre;

create policy "quiz_chapitre_lecture" on public.quiz_chapitre
  for select to authenticated
  using (
    exists (
      select 1
      from public.supports_seance s
      where s.id = quiz_chapitre.support_id
        and (
          public.peut_acceder_seance(s.seance_id)
          or (
            s.destinataire = 'stagiaire'
            and exists (
              select 1
              from public.seance_groupes sg
              join public.seances se on se.id = sg.seance_id
              where sg.groupe_id = public.groupe_du_stagiaire()
                and (
                  sg.seance_id = s.seance_id
                  or se.contenu_source_id = s.seance_id
                )
            )
          )
        )
    )
  );
