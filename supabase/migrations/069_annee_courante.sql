-- L'année scolaire sélectionnée (PRD §4.15.2).
--
-- Le choix se persiste en base plutôt que dans un cookie : un formateur qui
-- passe de son poste au centre à son ordinateur personnel doit retrouver
-- l'année sur laquelle il travaille, pas repartir sur celle que le navigateur
-- ignore.

alter table public.parametres_formateur
  add column if not exists annee_scolaire_courante uuid
    references public.annees_scolaires(id) on delete set null;

comment on column public.parametres_formateur.annee_scolaire_courante is
  'Année scolaire sélectionnée dans le sélecteur global. Null tant qu''aucun '
  'choix n''a été fait : c''est alors la plus récente qui s''applique.';

-- ── « Par défaut » devient « ce que le formateur a choisi » ───────────────
--
-- La fonction sert déjà de valeur par défaut à `groupes.annee_scolaire_id` et
-- aux trois tables datées (migration 067). En lui apprenant la sélection, tout
-- ce qui se crée atterrit dans l'année affichée à l'écran — sans qu'aucun
-- appel applicatif ait à transporter l'identifiant.
--
-- Le repli sur la plus récente reste : une sélection effacée par la suppression
-- d'une année ne doit pas laisser les écritures sans année du tout.

create or replace function public.annee_scolaire_par_defaut()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.annee_scolaire_courante
      from public.parametres_formateur p
      join public.annees_scolaires a on a.id = p.annee_scolaire_courante
      where p.formateur_id = auth.uid()
    ),
    (
      select id from public.annees_scolaires
      where formateur_id = auth.uid()
      order by date_debut desc
      limit 1
    )
  );
$$;

revoke execute on function public.annee_scolaire_par_defaut() from public, anon;
grant execute on function public.annee_scolaire_par_defaut() to authenticated;

-- ── Choisir une année ─────────────────────────────────────────────────────
--
-- Passer par une fonction plutôt que par un update direct garantit deux
-- choses : que l'année appartient bien au formateur, et que la ligne de
-- paramètres existe — un formateur qui n'a jamais ouvert Paramètres n'en a
-- pas encore.

create or replace function public.choisir_annee_scolaire(p_annee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_annee_id is not null and not exists (
    select 1 from public.annees_scolaires
    where id = p_annee_id and formateur_id = auth.uid()
  ) then
    raise exception 'Cette année scolaire n''est pas la vôtre.';
  end if;

  insert into public.parametres_formateur (formateur_id, annee_scolaire_courante)
  values (auth.uid(), p_annee_id)
  on conflict (formateur_id) do update
    set annee_scolaire_courante = excluded.annee_scolaire_courante,
        updated_at = now();
end;
$$;

revoke execute on function public.choisir_annee_scolaire(uuid) from public, anon;
grant execute on function public.choisir_annee_scolaire(uuid) to authenticated;
