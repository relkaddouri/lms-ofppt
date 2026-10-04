-- Surveillance d'un contrôle officiel : le socle en base.
--
-- Un contrôle officiel se surveille. Jusqu'ici le formateur ouvrait l'épreuve
-- et ne voyait plus rien jusqu'aux copies : ni qui avait quitté sa page, ni
-- qui avait fini. Deux choses se posent ici, et rien de plus — un seau pour
-- les captures d'écran, une table pour les événements.
--
-- Ce que le navigateur impose, et que cette migration ne cherche pas à
-- contourner : le partage d'écran demande un geste du stagiaire à chaque
-- passation, affiche un bandeau permanent, et lui laisse un bouton pour
-- l'arrêter. La surveillance est donc annoncée par construction. L'arrêt du
-- partage n'est pas empêché : il est *enregistré*, et c'est le formateur qui
-- en juge.

-- ── Le seau des captures ────────────────────────────────────────────────────
--
-- Privé, et il doit le rester : ce sont les écrans de stagiaires pendant une
-- épreuve. Rien ne s'y lit sans URL signée.
--
-- 400 Ko par image : le navigateur réduit la capture à ~640 px en JPEG avant
-- de l'envoyer, ce qui donne une quarantaine de kilo-octets. La limite est là
-- pour refuser tout de suite une capture pleine résolution, qui coûterait
-- vingt fois plus pour une mosaïque qu'on regarde en vignettes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'surveillance-controles',
  'surveillance-controles',
  false,
  409600,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le chemin est `<user_id>/<controle_id>.jpg`.
--
-- L'identifiant du compte en premier segment, comme pour les photos : la
-- policy d'écriture se dit alors en une ligne, sans jointure. Et le chemin est
-- stable, de sorte que chaque capture remplace la précédente — on surveille
-- un écran en direct, on ne constitue pas un film. Une épreuve de deux heures
-- laisse donc un fichier par stagiaire, pas deux cent quarante.
--
-- Les quatre verbes, et pas trois : `upsert` se traduit par
-- « insert … on conflict do update », et PostgreSQL exige alors de pouvoir
-- *lire* la ligne en conflit. C'est la faute des migrations 081 et 106,
-- corrigée deux fois par les 084 et 108 ; elle ne se refera pas une
-- troisième.
drop policy if exists "surveillance_depot_stagiaire" on storage.objects;
create policy "surveillance_depot_stagiaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'surveillance-controles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "surveillance_remplacement_stagiaire" on storage.objects;
create policy "surveillance_remplacement_stagiaire" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'surveillance-controles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "surveillance_lecture_stagiaire" on storage.objects;
create policy "surveillance_lecture_stagiaire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'surveillance-controles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "surveillance_retrait_stagiaire" on storage.objects;
create policy "surveillance_retrait_stagiaire" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'surveillance-controles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Le formateur lit les captures des contrôles qui sont les siens, et il les
-- efface.
--
-- Le nom du fichier porte l'identifiant du contrôle : on le rapproche par
-- jointure plutôt qu'en transtypant le nom du fichier en uuid. Un nom mal
-- formé — déposé à la main, ou resté d'une autre version — ferait échouer la
-- conversion et, avec elle, toute la policy. La jointure, elle, ne rend
-- simplement aucune ligne.
drop policy if exists "surveillance_lecture_formateur" on storage.objects;
create policy "surveillance_lecture_formateur" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'surveillance-controles'
    and exists (
      select 1
        from public.controles c
       where storage.filename(name) = c.id::text || '.jpg'
         and public.peut_acceder_controle(c.id)
    )
  );

drop policy if exists "surveillance_purge_formateur" on storage.objects;
create policy "surveillance_purge_formateur" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'surveillance-controles'
    and exists (
      select 1
        from public.controles c
       where storage.filename(name) = c.id::text || '.jpg'
         and public.peut_acceder_controle(c.id)
    )
  );

-- ── Les événements ──────────────────────────────────────────────────────────
--
-- Ce que la capture ne dit pas, parce qu'elle a vingt-cinq secondes de
-- retard : l'instant où un stagiaire quitte sa page. C'est le signal qui
-- compte, et c'est le seul que la mosaïque colore.
--
-- Pas de ligne d'état tenue à jour : on enregistre ce qui arrive, et l'écran
-- déduit l'état du dernier événement. Une ligne d'état aurait demandé une
-- écriture par changement *et* une relecture pour l'afficher.
create table if not exists public.surveillance_evenements (
  id uuid primary key default gen_random_uuid(),
  controle_id uuid not null references public.controles(id) on delete cascade,
  stagiaire_id uuid not null references public.stagiaires(id) on delete cascade,
  type text not null check (type in (
    -- Le geste de départ, et son refus.
    'partage_accepte',
    'partage_refuse',
    -- Le partage s'est interrompu : bouton du navigateur, onglet fermé.
    'partage_arrete',
    -- L'onglet n'est plus au premier plan, puis il y revient.
    'ecran_quitte',
    'ecran_revenu',
    -- Un collage dans une réponse. Ni une preuve ni une faute : une chose à
    -- regarder.
    'collage',
    -- Ni Safari sur iPhone ni iPad ne savent partager un écran. Le dire
    -- vaut mieux que laisser une carte vide dont on ne sait quoi penser.
    'appareil_incompatible'
  )),
  cree_le timestamptz not null default now()
);

comment on table public.surveillance_evenements is
  'Journal de la surveillance d''un contrôle : partage d''écran, sorties de page, collages. Écrit par le stagiaire surveillé, lu par le formateur du contrôle. Effacé avec les captures une fois les résultats publiés.';

-- La mosaïque lit les derniers événements d'un contrôle, jamais l'historique
-- d'un stagiaire : l'index suit cette lecture-là.
create index if not exists surveillance_evenements_controle_idx
  on public.surveillance_evenements (controle_id, cree_le desc);

alter table public.surveillance_evenements enable row level security;

-- Le stagiaire n'écrit que sur sa propre ligne, et seulement pour un contrôle
-- de son groupe. Il ne relit rien : ce journal n'est pas pour lui.
drop policy if exists "surveillance_evenements_depot" on public.surveillance_evenements;
create policy "surveillance_evenements_depot" on public.surveillance_evenements
  for insert to authenticated
  with check (
    exists (
      select 1 from public.stagiaires s
       where s.id = stagiaire_id and s.user_id = auth.uid()
    )
    and exists (
      select 1 from public.controles c
       where c.id = controle_id and c.groupe_id = public.groupe_du_stagiaire()
    )
  );

drop policy if exists "surveillance_evenements_lecture" on public.surveillance_evenements;
create policy "surveillance_evenements_lecture" on public.surveillance_evenements
  for select to authenticated
  using (public.peut_acceder_controle(controle_id));

drop policy if exists "surveillance_evenements_purge" on public.surveillance_evenements;
create policy "surveillance_evenements_purge" on public.surveillance_evenements
  for delete to authenticated
  using (public.peut_acceder_controle(controle_id));

-- ── Le contrôle est-il surveillé ? ─────────────────────────────────────────
--
-- Tous ne le sont pas. Un contrôle continu rendu à la maison, un test que le
-- formateur donne pour s'entraîner : rien à surveiller. La surveillance est
-- une décision prise épreuve par épreuve, au moment de l'ouvrir — et le
-- stagiaire doit l'apprendre avant de commencer, pas la découvrir.
--
-- Faux par défaut, donc : aucun contrôle existant ne devient surveillé du
-- fait de cette migration.
alter table public.controles
  add column if not exists surveille boolean not null default false;

comment on column public.controles.surveille is
  'Vrai : la passation exige le partage de l''écran entier, et le formateur suit les écrans en direct. Décidé à l''ouverture du contrôle. Faux par défaut — un contrôle n''est pas surveillé sans un geste explicite.';

-- ── Le direct ───────────────────────────────────────────────────────────────
--
-- Premier usage de Realtime dans ce projet, et c'est délibéré : la mosaïque
-- doit s'allumer à la seconde où un stagiaire quitte sa page. Une
-- vérification régulière aurait réveillé le serveur toutes les quelques
-- secondes pendant deux heures, pour vingt stagiaires — précisément ce que
-- les règles de ce dépôt interdisent. Un websocket ne coûte aucune exécution.
--
-- `postgres_changes` applique les policies du jeton qui écoute : le formateur
-- ne reçoit que les lignes que la policy de lecture lui rend déjà.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'surveillance_evenements'
  ) then
    alter publication supabase_realtime add table public.surveillance_evenements;
  end if;
end
$$;
