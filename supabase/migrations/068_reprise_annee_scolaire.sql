-- Reprise : rattacher l'existant à une première année scolaire (PRD §4.15).
--
-- Tout ce qui est déjà en base a été saisi pour une seule année. On la crée
-- pour chaque formateur qui a des données, et on y rattache ses groupes ainsi
-- que ses trois tables datées. Le libellé vient de ce que le formateur a déjà
-- renseigné dans Paramètres (§4.13bis) ; à défaut il se déduit de la date de
-- création de son premier groupe — l'année de formation commence en septembre,
-- pas en janvier.

do $$
declare
  f record;
  v_libelle text;
  v_an int;
  v_annee_id uuid;
  v_restants int;
begin
  for f in
    select distinct formateur_id from (
      select formateur_id from public.groupes where formateur_id is not null
      union select formateur_id from public.indisponibilites where formateur_id is not null
      union select formateur_id from public.rythmes_hebdomadaires where formateur_id is not null
      union select formateur_id from public.motifs_hebdomadaires where formateur_id is not null
    ) t
  loop
    select annee_scolaire into v_libelle
    from public.parametres_formateur
    where formateur_id = f.formateur_id;

    if v_libelle is null or v_libelle !~ '^[0-9]{4}/[0-9]{4}$' then
      select extract(year from min(created_at))::int
             - case when extract(month from min(created_at)) >= 9 then 0 else 1 end
        into v_an
      from public.groupes where formateur_id = f.formateur_id;

      v_an := coalesce(v_an, extract(year from now())::int
              - case when extract(month from now()) >= 9 then 0 else 1 end);
      v_libelle := v_an || '/' || (v_an + 1);
    end if;

    v_an := split_part(v_libelle, '/', 1)::int;

    insert into public.annees_scolaires (formateur_id, libelle, date_debut, date_fin)
    values (
      f.formateur_id,
      v_libelle,
      make_date(v_an, 9, 1),
      make_date(v_an + 1, 8, 31)
    )
    on conflict (formateur_id, libelle) do nothing;

    select id into v_annee_id
    from public.annees_scolaires
    where formateur_id = f.formateur_id and libelle = v_libelle;

    update public.groupes set annee_scolaire_id = v_annee_id
      where formateur_id = f.formateur_id and annee_scolaire_id is null;
    update public.indisponibilites set annee_scolaire_id = v_annee_id
      where formateur_id = f.formateur_id and annee_scolaire_id is null;
    update public.rythmes_hebdomadaires set annee_scolaire_id = v_annee_id
      where formateur_id = f.formateur_id and annee_scolaire_id is null;
    update public.motifs_hebdomadaires set annee_scolaire_id = v_annee_id
      where formateur_id = f.formateur_id and annee_scolaire_id is null;

    raise notice 'Année % rattachée au formateur %', v_libelle, f.formateur_id;
  end loop;

  -- Vérification : plus rien ne doit rester sans année chez un formateur qui
  -- en a une. Une ligne orpheline disparaîtrait de tous les écrans dès que le
  -- filtrage entrera en service (§4.15.3), sans dire pourquoi.
  select count(*) into v_restants from (
    select 1 from public.groupes g
      where g.formateur_id is not null and g.annee_scolaire_id is null
    union all select 1 from public.indisponibilites i
      where i.formateur_id is not null and i.annee_scolaire_id is null
    union all select 1 from public.rythmes_hebdomadaires r
      where r.formateur_id is not null and r.annee_scolaire_id is null
    union all select 1 from public.motifs_hebdomadaires m
      where m.formateur_id is not null and m.annee_scolaire_id is null
  ) t;

  if v_restants > 0 then
    raise exception 'Reprise incomplète : % ligne(s) sans année scolaire.', v_restants;
  end if;
end $$;
