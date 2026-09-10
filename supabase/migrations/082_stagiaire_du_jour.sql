-- Le stagiaire de la journée (PRD §4.5).
--
-- À la fin d'une séance, le formateur note la participation de chacun sur 10.
-- La meilleure note désigne le stagiaire de la journée ; les autres
-- l'apprennent en ouvrant l'application, et le félicitent dans le fil.
--
-- Trois tables et pas une de plus : les notes, la distinction, et qui l'a
-- déjà vue. Tout le reste — la série de jours, le départage — se calcule.

-- ── Les notes de participation ─────────────────────────────────────────────
--
-- Une note par stagiaire et par séance, sur 10, au demi-point. Le demi-point
-- n'est pas cosmétique : sur un groupe de seize, des notes entières
-- produiraient des ex æquo presque chaque jour, et le départage — qui est une
-- règle, donc une convention — s'appliquerait plus souvent que la note
-- elle-même, qui est un jugement.
create table if not exists public.notations_seance (
  seance_id uuid not null references public.seances (id) on delete cascade,
  stagiaire_id uuid not null references public.stagiaires (id) on delete cascade,
  note numeric(3, 1) not null
    check (note >= 0 and note <= 10 and (note * 2) = floor(note * 2)),
  created_at timestamptz not null default now(),
  primary key (seance_id, stagiaire_id)
);

comment on table public.notations_seance is
  'Participation d''un stagiaire à une séance, sur 10 au demi-point (PRD §4.5).';

-- ── La distinction ─────────────────────────────────────────────────────────
--
-- `serie` compte les distinctions consécutives du même stagiaire pour ce
-- groupe : elle est calculée à la désignation et figée, plutôt que recomptée
-- à l'affichage. Une distinction supprimée plus tard ne doit pas réécrire
-- l'histoire de celles qui ont suivi.
create table if not exists public.distinctions_jour (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.groupes (id) on delete cascade,
  seance_id uuid not null references public.seances (id) on delete cascade,
  stagiaire_id uuid not null references public.stagiaires (id) on delete cascade,
  date date not null,
  note numeric(3, 1) not null,
  serie integer not null default 1 check (serie >= 1),
  -- L'annonce qui porte les félicitations. Nulle si sa création a échoué :
  -- une distinction sans annonce vaut mieux qu'une séance qu'on ne peut pas
  -- clore.
  annonce_id uuid references public.annonces (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Une seule distinction par séance : recliquer sur « Fait » ne recouronne
  -- personne.
  unique (seance_id)
);

create index if not exists distinctions_groupe_idx
  on public.distinctions_jour (groupe_id, date desc);

comment on table public.distinctions_jour is
  'Stagiaire distingué à l''issue d''une séance, et série de ses distinctions consécutives (PRD §4.5).';

-- ── Qui a déjà vu la fête ──────────────────────────────────────────────────
--
-- La modale s'ouvre une fois par personne. Sans cette table, elle se
-- rouvrirait à chaque navigation, ce qui transformerait une célébration en
-- gêne.
create table if not exists public.distinctions_vues (
  distinction_id uuid not null
    references public.distinctions_jour (id) on delete cascade,
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  vue_le timestamptz not null default now(),
  primary key (distinction_id, user_id)
);

-- ── Accès ──────────────────────────────────────────────────────────────────

alter table public.notations_seance enable row level security;
alter table public.distinctions_jour enable row level security;
alter table public.distinctions_vues enable row level security;

-- Les notes de participation restent entre les mains du formateur. Elles ne
-- sont pas un bulletin : les exposer ferait de la distinction un classement,
-- et d'une séance ordinaire une évaluation permanente.
drop policy if exists "notations_formateur" on public.notations_seance;
create policy "notations_formateur" on public.notations_seance
  for all to authenticated
  using (
    exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = notations_seance.seance_id
        and public.peut_acceder_groupe(sg.groupe_id)
    )
  )
  with check (
    exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = notations_seance.seance_id
        and public.peut_acceder_groupe(sg.groupe_id)
    )
  );

-- La distinction, elle, se lit par tout le groupe : c'est son objet.
drop policy if exists "distinctions_lecture" on public.distinctions_jour;
create policy "distinctions_lecture" on public.distinctions_jour
  for select to authenticated
  using (
    groupe_id = public.groupe_du_stagiaire()
    or public.peut_acceder_groupe(groupe_id)
  );

drop policy if exists "distinctions_ecriture" on public.distinctions_jour;
create policy "distinctions_ecriture" on public.distinctions_jour
  for all to authenticated
  using (public.peut_acceder_groupe(groupe_id))
  with check (public.peut_acceder_groupe(groupe_id));

-- Chacun ne marque que sa propre lecture.
drop policy if exists "distinctions_vues_lecture" on public.distinctions_vues;
create policy "distinctions_vues_lecture" on public.distinctions_vues
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "distinctions_vues_ecriture" on public.distinctions_vues;
create policy "distinctions_vues_ecriture" on public.distinctions_vues
  for insert to authenticated
  with check (user_id = auth.uid());

-- ── La désignation ─────────────────────────────────────────────────────────
--
-- Une fonction plutôt qu'un enchaînement de requêtes : la note gagnante, le
-- départage, la série et l'annonce doivent être décidés d'un seul tenant. Deux
-- clics sur « Fait » à quelques secondes d'intervalle produiraient sinon deux
-- gagnants différents pour la même séance.
--
-- Le départage, quand plusieurs stagiaires ont la même note : celui qui a été
-- distingué le moins récemment. Une distinction quotidienne qui revient
-- toujours au même cesse d'encourager les autres ; ce critère la fait tourner
-- sans rien fausser, puisqu'il ne s'applique qu'entre notes identiques. À
-- égalité parfaite — personne n'a jamais été distingué — l'identifiant tranche,
-- ce qui est arbitraire mais stable : deux appels rendent le même gagnant.
create or replace function public.designer_stagiaire_du_jour(
  p_seance_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_groupe uuid;
  v_date date;
  v_gagnant uuid;
  v_note numeric(3, 1);
  v_precedent uuid;
  v_serie integer := 1;
  v_id uuid;
begin
  select sg.groupe_id, s.date
    into v_groupe, v_date
    from public.seances s
    join public.seance_groupes sg on sg.seance_id = s.id
   where s.id = p_seance_id
     and public.peut_acceder_groupe(sg.groupe_id)
   limit 1;

  if v_groupe is null then
    raise exception 'Accès refusé à cette séance.';
  end if;

  -- Un absent n'est pas distingué : la participation d'un absent n'existe pas,
  -- et la classe le verrait tout de suite.
  select n.stagiaire_id, n.note
    into v_gagnant, v_note
    from public.notations_seance n
    left join public.presences p
      on p.seance_id = n.seance_id and p.stagiaire_id = n.stagiaire_id
   where n.seance_id = p_seance_id
     and coalesce(p.present, true) is true
   order by
     n.note desc,
     -- Le moins récemment distingué passe devant. `nulls first` : celui qui ne
     -- l'a jamais été précède celui qui l'a été il y a longtemps.
     (
       select max(d.date)
         from public.distinctions_jour d
        where d.stagiaire_id = n.stagiaire_id
          and d.groupe_id = v_groupe
     ) asc nulls first,
     n.stagiaire_id asc
   limit 1;

  if v_gagnant is null then
    return null;
  end if;

  -- La série : la distinction précédente de ce groupe portait-elle sur la
  -- même personne ?
  select d.stagiaire_id, d.serie
    into v_precedent, v_serie
    from public.distinctions_jour d
   where d.groupe_id = v_groupe
   order by d.date desc, d.created_at desc
   limit 1;

  if v_precedent is distinct from v_gagnant then
    v_serie := 1;
  else
    v_serie := coalesce(v_serie, 0) + 1;
  end if;

  insert into public.distinctions_jour (
    groupe_id, seance_id, stagiaire_id, date, note, serie
  )
  values (
    v_groupe, p_seance_id, v_gagnant, coalesce(v_date, current_date),
    v_note, v_serie
  )
  on conflict (seance_id) do nothing
  returning id into v_id;

  -- `do nothing` a pu ne rien rendre : la séance était déjà close.
  if v_id is null then
    select id into v_id
      from public.distinctions_jour
     where seance_id = p_seance_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.designer_stagiaire_du_jour(uuid) to authenticated;
