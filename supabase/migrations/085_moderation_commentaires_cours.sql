-- La modération des questions de cours (PRD §4.4).
--
-- Des stagiaires écrivent sous les cours des messages qui n'y ont pas leur
-- place, et tout le groupe les lit aussitôt. Le formateur n'avait aucune
-- prise : pas de validation, pas d'interrupteur, et une suppression permise
-- par les policies mais qu'aucun écran ne proposait.
--
-- Trois leviers, tenus en base plutôt qu'à l'écran — un écran se contourne
-- en appelant l'API directement, une policy non :
--
--   1. un statut sur chaque question et chaque réponse ; ce qu'écrit un
--      stagiaire attend la validation, et reste invisible aux autres ;
--   2. deux interrupteurs dans les paramètres du formateur : les questions
--      ouvertes ou fermées, et la validation obligatoire ou non ;
--   3. la suppression, étendue au formateur qui accède au groupe.

-- ── Le statut ──────────────────────────────────────────────────────────────
--
-- `publiee` par défaut : les messages déjà écrits restent visibles tels
-- qu'ils l'étaient. Rendre l'historique invisible d'un coup, le jour du
-- déploiement, aurait vidé les fils sans que personne comprenne pourquoi.
alter table public.questions_support
  add column if not exists statut text not null default 'publiee'
    check (statut in ('en_attente', 'publiee'));

alter table public.reponses_question
  add column if not exists statut text not null default 'publiee'
    check (statut in ('en_attente', 'publiee'));

comment on column public.questions_support.statut is
  'en_attente tant que le formateur n''a pas validé une question de stagiaire ; seul son auteur et le formateur la voient.';
comment on column public.reponses_question.statut is
  'en_attente tant que le formateur n''a pas validé une réponse de stagiaire ; seul son auteur et le formateur la voient.';

create index if not exists questions_support_attente_idx
  on public.questions_support (formateur_id) where statut = 'en_attente';
create index if not exists reponses_question_attente_idx
  on public.reponses_question (question_id) where statut = 'en_attente';

-- ── Les interrupteurs ──────────────────────────────────────────────────────
--
-- Validation obligatoire par défaut : c'est la raison même de cette
-- migration. Les questions restent ouvertes par défaut : les fermer d'office
-- aurait retiré aux stagiaires un moyen de demander de l'aide qui, lui,
-- fonctionne.
alter table public.parametres_formateur
  add column if not exists commentaires_cours_ouverts boolean not null default true,
  add column if not exists commentaires_cours_valides boolean not null default true;

comment on column public.parametres_formateur.commentaires_cours_ouverts is
  'Faux : aucun stagiaire ne peut plus poser de question ni répondre sous les cours. Les messages publiés restent lisibles.';
comment on column public.parametres_formateur.commentaires_cours_valides is
  'Vrai : ce qu''écrit un stagiaire sous un cours attend la validation du formateur avant d''être visible du groupe.';

-- ── Qui est stagiaire ──────────────────────────────────────────────────────
--
-- La même question que dans le panneau de notifications, posée à la même
-- table : est stagiaire celui qui a une fiche. `profils` ne se lit pas ici —
-- sa policy ne rend à chacun que sa propre ligne.
create or replace function public.est_stagiaire()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.stagiaires where user_id = auth.uid());
$$;

grant execute on function public.est_stagiaire() to authenticated;

-- ── Les réglages qui s'appliquent à un groupe ──────────────────────────────
--
-- Ceux du formateur du groupe, lus pour le compte du stagiaire : sa policy ne
-- lui ouvre pas `parametres_formateur`, et il doit pourtant savoir si le
-- champ de saisie a lieu d'être. Un formateur qui n'a jamais ouvert ses
-- paramètres n'a pas de ligne : les valeurs par défaut s'appliquent.
create or replace function public.reglages_commentaires_groupe(p_groupe uuid)
returns table (ouverts boolean, valides boolean)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.commentaires_cours_ouverts, true),
         coalesce(p.commentaires_cours_valides, true)
    from public.groupes g
    left join public.parametres_formateur p on p.formateur_id = g.formateur_id
   where g.id = p_groupe
     and (
       g.id = public.groupe_du_stagiaire()
       or public.peut_acceder_groupe(g.id)
     );
$$;

grant execute on function public.reglages_commentaires_groupe(uuid) to authenticated;

-- ── Lecture : ce qui attend reste entre l'auteur et le formateur ───────────
drop policy if exists "questions_support_lecture" on public.questions_support;
create policy "questions_support_lecture" on public.questions_support
  for select to authenticated
  using (
    formateur_id = auth.uid()
    or (groupe_id is not null and public.peut_acceder_groupe(groupe_id))
    or (
      groupe_id is not null
      and groupe_id = public.groupe_du_stagiaire()
      and (statut = 'publiee' or auteur_id = auth.uid())
    )
  );

drop policy if exists "reponses_question_lecture" on public.reponses_question;
create policy "reponses_question_lecture" on public.reponses_question
  for select to authenticated
  using (
    public.peut_acceder_question(question_id)
    and (
      statut = 'publiee'
      or auteur_id = auth.uid()
      or exists (
        select 1 from public.questions_support q
         where q.id = reponses_question.question_id
           and (
             q.formateur_id = auth.uid()
             or (q.groupe_id is not null and public.peut_acceder_groupe(q.groupe_id))
           )
      )
    )
  );

-- ── Suppression : le formateur du groupe, pas seulement celui de la ligne ──
--
-- La policy des réponses ne reconnaissait que `formateur_id` de la question.
-- Elle rejoint celle des questions : quiconque gère le groupe modère son fil.
drop policy if exists "reponses_question_suppression" on public.reponses_question;
create policy "reponses_question_suppression" on public.reponses_question
  for delete to authenticated
  using (
    auteur_id = auth.uid()
    or exists (
      select 1 from public.questions_support q
       where q.id = reponses_question.question_id
         and (
           q.formateur_id = auth.uid()
           or (q.groupe_id is not null and public.peut_acceder_groupe(q.groupe_id))
         )
    )
  );

-- ── Poser une question ─────────────────────────────────────────────────────
--
-- Reprise de la migration 080, avec deux contrôles de plus : les questions
-- doivent être ouvertes pour un stagiaire, et son message part en attente
-- quand la validation est demandée. Le formateur, lui, n'est ni fermé ni
-- modéré — c'est lui qui modère.
create or replace function public.poser_question_support(
  p_support_id uuid,
  p_texte text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_support record;
  v_groupe uuid;
  v_reglages record;
  v_statut text := 'publiee';
  v_id uuid;
begin
  select s.id as seance_id, s.module_id, s.date,
         coalesce(sup.contenu ->> 'titre', m.nom) as titre
    into v_support
    from public.supports_seance sup
    join public.seances s on s.id = sup.seance_id
    join public.modules m on m.id = s.module_id
   where sup.id = p_support_id;

  if v_support is null then
    raise exception 'Support introuvable.';
  end if;

  with groupes_du_support as (
    select sg.groupe_id
      from public.seance_groupes sg
     where sg.seance_id = v_support.seance_id
    union
    select sg.groupe_id
      from public.seances miroir
      join public.seance_groupes sg on sg.seance_id = miroir.id
     where miroir.contenu_source_id = v_support.seance_id
  )
  select g.groupe_id
    into v_groupe
    from groupes_du_support g
   where g.groupe_id = public.groupe_du_stagiaire()
      or public.peut_acceder_groupe(g.groupe_id)
   order by (g.groupe_id = public.groupe_du_stagiaire()) desc
   limit 1;

  if v_groupe is null then
    raise exception 'Accès refusé à ce support.';
  end if;

  if public.est_stagiaire() then
    select * into v_reglages from public.reglages_commentaires_groupe(v_groupe);
    if not coalesce(v_reglages.ouverts, true) then
      raise exception 'Les questions sont fermées sur les cours pour le moment.';
    end if;
    if coalesce(v_reglages.valides, true) then
      v_statut := 'en_attente';
    end if;
  end if;

  insert into public.questions_support (
    support_id, module_id, groupe_id, formateur_id,
    annee_scolaire, support_titre, auteur_id, texte, statut
  )
  select
    p_support_id,
    v_support.module_id,
    v_groupe,
    g.formateur_id,
    public.annee_scolaire(coalesce(v_support.date, current_date)),
    v_support.titre,
    auth.uid(),
    p_texte,
    v_statut
  from public.groupes g
  where g.id = v_groupe
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.poser_question_support(uuid, text) to authenticated;

-- ── Répondre ───────────────────────────────────────────────────────────────
--
-- `peut_acceder_question` ne regarde que le groupe : un stagiaire pouvait
-- répondre à la question en attente d'un camarade dont il aurait eu
-- l'identifiant. Il faut désormais qu'il puisse la voir.
create or replace function public.repondre_question(
  p_question_id uuid,
  p_texte text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question record;
  v_reglages record;
  v_statut text := 'publiee';
  v_id uuid;
begin
  if not public.peut_acceder_question(p_question_id) then
    raise exception 'Accès refusé à cette question.';
  end if;

  select groupe_id, statut, auteur_id into v_question
    from public.questions_support
   where id = p_question_id;

  if public.est_stagiaire() then
    if v_question.statut <> 'publiee' and v_question.auteur_id <> auth.uid() then
      raise exception 'Accès refusé à cette question.';
    end if;

    select * into v_reglages
      from public.reglages_commentaires_groupe(v_question.groupe_id);
    if not coalesce(v_reglages.ouverts, true) then
      raise exception 'Les questions sont fermées sur les cours pour le moment.';
    end if;
    if coalesce(v_reglages.valides, true) then
      v_statut := 'en_attente';
    end if;
  end if;

  insert into public.reponses_question (question_id, auteur_id, texte, statut)
  values (p_question_id, auth.uid(), p_texte, v_statut)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.repondre_question(uuid, text) to authenticated;

-- ── Valider ────────────────────────────────────────────────────────────────
--
-- Une fonction plutôt qu'une policy de mise à jour : le formateur ne doit
-- pouvoir changer que le statut, jamais le texte d'un stagiaire. Une policy
-- `update` lui aurait permis de réécrire ce qu'un autre a signé.
create or replace function public.publier_message_cours(
  p_genre text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_groupe uuid;
  v_formateur uuid;
begin
  if p_genre = 'question' then
    select groupe_id, formateur_id into v_groupe, v_formateur
      from public.questions_support where id = p_id;
  elsif p_genre = 'reponse' then
    select q.groupe_id, q.formateur_id into v_groupe, v_formateur
      from public.reponses_question r
      join public.questions_support q on q.id = r.question_id
     where r.id = p_id;
  else
    raise exception 'Genre de message inconnu.';
  end if;

  if v_formateur is distinct from auth.uid()
     and not (v_groupe is not null and public.peut_acceder_groupe(v_groupe)) then
    raise exception 'Accès refusé à ce message.';
  end if;

  if p_genre = 'question' then
    update public.questions_support set statut = 'publiee' where id = p_id;
  else
    update public.reponses_question set statut = 'publiee' where id = p_id;
  end if;
end;
$$;

grant execute on function public.publier_message_cours(text, uuid) to authenticated;
