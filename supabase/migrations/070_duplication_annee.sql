-- Duplication d'une année scolaire (PRD §4.15.4).
--
-- L'objectif explicite : ne jamais regénérer par IA ce qui a déjà été produit
-- l'année précédente. Le formateur reconduit ses groupes, ses assignations,
-- ses séances déjà réparties, ses fiches et ses contrôles ; seuls les
-- stagiaires et leurs copies repartent de zéro, puisque ce sont de nouvelles
-- personnes.
--
-- Tout se fait en une fonction plutôt qu'en une suite d'appels applicatifs :
-- une duplication interrompue à mi-chemin laisserait une année à moitié
-- peuplée, sans moyen simple de savoir où elle s'est arrêtée. Ici, elle passe
-- entière ou pas du tout.

create or replace function public.dupliquer_annee(
  p_annee_source uuid,
  p_libelle text,
  p_groupe_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_formateur uuid := auth.uid();
  v_an int;
  v_nouvelle uuid;
  v_groupe record;
  v_nouveau_groupe uuid;
  v_seance record;
  v_nouvelle_seance uuid;
  v_controle record;
  v_nouveau_controle uuid;
begin
  if v_formateur is null then
    raise exception 'Authentification requise.';
  end if;

  if not exists (
    select 1 from public.annees_scolaires
    where id = p_annee_source and formateur_id = v_formateur
  ) then
    raise exception 'Cette année scolaire n''est pas la vôtre.';
  end if;

  if p_libelle !~ '^[0-9]{4}/[0-9]{4}$' then
    raise exception 'L''année scolaire s''écrit au format 2026/2027.';
  end if;

  if coalesce(array_length(p_groupe_ids, 1), 0) = 0 then
    raise exception 'Choisissez au moins un groupe à reconduire.';
  end if;

  v_an := split_part(p_libelle, '/', 1)::int;

  -- ── 1. L'année, puis les groupes et leurs assignations ────────────────
  insert into public.annees_scolaires (formateur_id, libelle, date_debut, date_fin)
  values (v_formateur, p_libelle, make_date(v_an, 9, 1), make_date(v_an + 1, 8, 31))
  returning id into v_nouvelle;

  -- Table de correspondance ancien → nouveau, le temps de la transaction :
  -- chaque étape suivante en dépend.
  create temp table correspondance_groupes (ancien uuid primary key, nouveau uuid)
    on commit drop;
  create temp table correspondance_seances (ancien uuid primary key, nouveau uuid)
    on commit drop;

  for v_groupe in
    select * from public.groupes
    where annee_scolaire_id = p_annee_source
      and formateur_id = v_formateur
      and id = any(p_groupe_ids)
  loop
    insert into public.groupes (nom, annee, specialite_id, formateur_id, annee_scolaire_id)
    values (v_groupe.nom, v_groupe.annee, v_groupe.specialite_id, v_formateur, v_nouvelle)
    returning id into v_nouveau_groupe;

    insert into correspondance_groupes values (v_groupe.id, v_nouveau_groupe);

    -- Les quatre valeurs semestrielles sont copiées, pas recalculées depuis la
    -- durée de référence : c'est le travail de répartition de l'an dernier.
    insert into public.groupe_modules (
      groupe_id, module_id, formateur_id,
      presentiel_s1, fad_s1, presentiel_s2, fad_s2, fad_mutualisee, type_efm
    )
    select v_nouveau_groupe, gm.module_id, v_formateur,
           gm.presentiel_s1, gm.fad_s1, gm.presentiel_s2, gm.fad_s2,
           gm.fad_mutualisee, gm.type_efm
    from public.groupe_modules gm
    where gm.groupe_id = v_groupe.id;
  end loop;

  -- ── 2. Les séances, sans date ─────────────────────────────────────────
  --
  -- Une séance partagée entre deux groupes reconduits doit rester UNE séance
  -- reliée aux deux, pas deux séances : d'où le parcours par séance distincte
  -- plutôt que par groupe.

  for v_seance in
    select distinct s.*
    from public.seances s
    join public.seance_groupes sg on sg.seance_id = s.id
    where sg.groupe_id in (select ancien from correspondance_groupes)
  loop
    insert into public.seances (
      module_id, date, contenu_prevu, statut, heure_debut, heure_fin,
      objectif_operationnel, suggestion_pedagogique_id, nature,
      duree_prevue, est_fad, lien_teams, cree_par
    )
    values (
      v_seance.module_id,
      null,             -- « à planifier » : le nouveau motif les datera
      v_seance.contenu_prevu,
      'a_faire',
      null, null,       -- les horaires viennent du motif, comme les dates
      v_seance.objectif_operationnel,
      v_seance.suggestion_pedagogique_id,
      v_seance.nature,
      v_seance.duree_prevue,
      v_seance.est_fad,
      v_seance.lien_teams,
      v_formateur
    )
    returning id into v_nouvelle_seance;

    insert into correspondance_seances values (v_seance.id, v_nouvelle_seance);

    insert into public.seance_groupes (seance_id, groupe_id)
    select v_nouvelle_seance, c.nouveau
    from public.seance_groupes sg
    join correspondance_groupes c on c.ancien = sg.groupe_id
    where sg.seance_id = v_seance.id;

    -- Les éléments de contenu suivent : la répartition (§4.2bis) est faite,
    -- il n'y a aucune raison de la refaire tourner.
    insert into public.seance_elements_contenu (seance_id, element_contenu_id)
    select v_nouvelle_seance, sec.element_contenu_id
    from public.seance_elements_contenu sec
    where sec.seance_id = v_seance.id;
  end loop;

  -- ── 3. Les fiches de préparation, comme brouillon réutilisable ────────
  --
  -- Seule la dernière version de chaque fiche est reprise : l'historique des
  -- révisions appartient à l'année où elles ont été écrites.

  insert into public.fiches_preparation (seance_id, contenu, version)
  select c.nouveau, f.contenu, 1
  from correspondance_seances c
  join lateral (
    select contenu from public.fiches_preparation
    where seance_id = c.ancien
    order by version desc
    limit 1
  ) f on true;

  -- ── 4. Les contrôles, en brouillon et sans copie ──────────────────────

  for v_controle in
    select ct.*, cg.nouveau as nouveau_groupe
    from public.controles ct
    join correspondance_groupes cg on cg.ancien = ct.groupe_id
  loop
    insert into public.controles (
      module_id, groupe_id, titre, consignes, duree_heures,
      statut, type, type_efm, format,
      date_prevue, date_administration, date_envoi_propositions
    )
    values (
      v_controle.module_id, v_controle.nouveau_groupe, v_controle.titre,
      v_controle.consignes, v_controle.duree_heures,
      -- Jamais validé d'office : une banque de questions se relit avant de
      -- redevenir une épreuve.
      'brouillon', v_controle.type, v_controle.type_efm, v_controle.format,
      null, null, null
    )
    returning id into v_nouveau_controle;

    insert into public.questions_controle (
      controle_id, enonce, bareme, corrige, position, type, options,
      difficulte, justification_bareme
    )
    select v_nouveau_controle, q.enonce, q.bareme, q.corrige, q.position,
           q.type, q.options, q.difficulte, q.justification_bareme
    from public.questions_controle q
    where q.controle_id = v_controle.id
    order by q.position;
  end loop;

  -- Ce qui n'est jamais repris : stagiaires, copies, présences, annonces,
  -- devoirs, remarques de séance, dossiers de stage — spécifiques aux
  -- personnes et aux dates de l'année. Et le motif hebdomadaire, qui se
  -- redéclare (§4.9).

  return v_nouvelle;
end;
$$;

revoke execute on function public.dupliquer_annee(uuid, text, uuid[]) from public, anon;
grant execute on function public.dupliquer_annee(uuid, text, uuid[]) to authenticated;
