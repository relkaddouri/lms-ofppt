-- PRD §4.2bis — Couverture garantie du référentiel national.
--
-- L'EFF est construit en référence directe au référentiel : chaque élément de
-- contenu doit avoir été effectivement traité en séance. Le produit ne savait
-- pas le vérifier — il suivait les heures, pas le contenu.
--
-- Deux obstacles, dans cet ordre :
--
-- 1. `suggestions_pedagogiques.elements_contenu` est un bloc de texte, pas des
--    lignes adressables. Rien à référencer. On l'éclate d'abord.
-- 2. Aucun lien entre une séance et ce qu'elle couvre précisément. La séance
--    ne pointait que vers l'apprentissage entier.

create table if not exists public.elements_contenu (
  id uuid primary key default gen_random_uuid(),
  suggestion_pedagogique_id uuid not null
    references public.suggestions_pedagogiques(id) on delete cascade,
  ordre smallint not null,
  intitule text not null,
  created_at timestamptz not null default now(),
  unique (suggestion_pedagogique_id, ordre)
);

create index if not exists elements_contenu_suggestion_idx
  on public.elements_contenu (suggestion_pedagogique_id, ordre);

comment on table public.elements_contenu is
  'Éléments de contenu du référentiel national, une ligne par élément. '
  'Éclatés depuis suggestions_pedagogiques.elements_contenu, qui reste la '
  'source d''origine et n''est pas supprimée.';

-- ── Éclatement du bloc de texte ───────────────────────────────────────────
--
-- Une ligne qui commence par une minuscule ou une ponctuation n'est pas un
-- nouvel élément : c'est la suite du précédent, coupé à la saisie. Sur les
-- 356 lignes du référentiel, un seul cas — mais le recoller vaut mieux que
-- créer un élément « et vocabulaire utilisés ».

do $$
declare
  s record;
  ligne text;
  accumule text;
  rang smallint;
begin
  for s in
    select id, elements_contenu
      from public.suggestions_pedagogiques
     where coalesce(elements_contenu, '') <> ''
       and not exists (
         select 1 from public.elements_contenu e
         where e.suggestion_pedagogique_id = suggestions_pedagogiques.id
       )
  loop
    accumule := null;
    rang := 0;

    foreach ligne in array string_to_array(s.elements_contenu, chr(10)) loop
      ligne := btrim(ligne);
      continue when ligne = '';

      if accumule is not null
         and (left(ligne, 1) = lower(left(ligne, 1))
              and left(ligne, 1) ~ '[a-zà-ÿ(,;]') then
        accumule := accumule || ' ' || ligne;
      else
        if accumule is not null then
          rang := rang + 1;
          insert into public.elements_contenu
            (suggestion_pedagogique_id, ordre, intitule)
          values (s.id, rang, accumule);
        end if;
        accumule := ligne;
      end if;
    end loop;

    if accumule is not null then
      rang := rang + 1;
      insert into public.elements_contenu
        (suggestion_pedagogique_id, ordre, intitule)
      values (s.id, rang, accumule);
    end if;
  end loop;
end $$;

-- ── Ce qu'une séance couvre précisément ───────────────────────────────────

create table if not exists public.seance_elements_contenu (
  seance_id uuid not null references public.seances(id) on delete cascade,
  element_contenu_id uuid not null
    references public.elements_contenu(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (seance_id, element_contenu_id)
);

create index if not exists seance_elements_element_idx
  on public.seance_elements_contenu (element_contenu_id);

comment on table public.seance_elements_contenu is
  'Répartition non chevauchante des éléments de contenu sur les séances d''un '
  'apprentissage : l''ensemble des séances doit couvrir 100 %% de la liste '
  'officielle, sans doublon ni oubli.';

-- ── Accès ─────────────────────────────────────────────────────────────────
--
-- Le référentiel se lit par tout compte authentifié — c'est un document
-- public du programme national. La répartition, elle, appartient à la séance.

alter table public.elements_contenu enable row level security;
alter table public.seance_elements_contenu enable row level security;

drop policy if exists "elements_contenu_lecture" on public.elements_contenu;
create policy "elements_contenu_lecture" on public.elements_contenu
  for select to authenticated using (true);

drop policy if exists "seance_elements_proprietaire" on public.seance_elements_contenu;
create policy "seance_elements_proprietaire" on public.seance_elements_contenu
  for all to authenticated
  using (peut_acceder_seance(seance_id))
  with check (peut_acceder_seance(seance_id));

drop policy if exists "seance_elements_lecture_stagiaire" on public.seance_elements_contenu;
create policy "seance_elements_lecture_stagiaire" on public.seance_elements_contenu
  for select to authenticated
  using (
    exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = seance_elements_contenu.seance_id
        and sg.groupe_id = groupe_du_stagiaire()
    )
  );
