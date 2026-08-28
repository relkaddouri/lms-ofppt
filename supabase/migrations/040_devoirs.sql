-- 040 — Devoirs et rendus.
--
-- Un devoir est assigné à un groupe. Il peut se rattacher à une séance ou à un
-- module, ou à ni l'un ni l'autre — un devoir de vacances n'appartient à aucune
-- séance. Le groupe, lui, est toujours connu : c'est lui qui détermine à qui le
-- devoir s'adresse et qui peut le voir.

create table if not exists public.devoirs (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.groupes (id) on delete cascade,
  seance_id uuid references public.seances (id) on delete set null,
  module_id uuid references public.modules (id) on delete set null,
  titre text not null check (length(trim(titre)) > 0),
  description text,
  date_echeance date,
  type_rendu text not null default 'texte'
    check (type_rendu in ('texte', 'lien', 'fichier')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.devoirs is
  'Devoir assigné à un groupe, éventuellement rattaché à une séance ou un module.';
comment on column public.devoirs.type_rendu is
  'Forme attendue du rendu. « fichier » suppose un espace de stockage, qui n''est pas encore configuré.';

create index if not exists devoirs_groupe_idx
  on public.devoirs (groupe_id, date_echeance);

create table if not exists public.devoirs_rendus (
  id uuid primary key default gen_random_uuid(),
  devoir_id uuid not null references public.devoirs (id) on delete cascade,
  stagiaire_id uuid not null references public.stagiaires (id) on delete cascade,
  contenu text,
  date_rendu timestamptz,
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'rendu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un rendu par stagiaire et par devoir : le brouillon devient le rendu, il ne
  -- s'y ajoute pas.
  unique (devoir_id, stagiaire_id),
  constraint rendu_date_coherente
    check (statut = 'brouillon' or date_rendu is not null)
);

comment on table public.devoirs_rendus is
  'Rendu d''un stagiaire. Un brouillon reste modifiable ; un rendu est daté.';

create index if not exists devoirs_rendus_devoir_idx
  on public.devoirs_rendus (devoir_id);

alter table public.devoirs enable row level security;
alter table public.devoirs_rendus enable row level security;

-- Le formateur gère les devoirs de ses groupes ; le stagiaire lit ceux du sien.
create policy "devoirs_formateur" on public.devoirs
  for all to authenticated
  using (public.peut_acceder_groupe(groupe_id))
  with check (public.peut_acceder_groupe(groupe_id));

create policy "devoirs_lecture_stagiaire" on public.devoirs
  for select to authenticated
  using (groupe_id = public.groupe_du_stagiaire());

-- Le formateur voit tous les rendus de ses groupes, sans pouvoir les écrire à
-- la place des stagiaires.
create policy "rendus_lecture_formateur" on public.devoirs_rendus
  for select to authenticated
  using (
    exists (
      select 1 from public.devoirs d
      where d.id = devoirs_rendus.devoir_id
        and public.peut_acceder_groupe(d.groupe_id)
    )
  );

-- Le stagiaire n'écrit que le sien, et seulement tant qu'il est brouillon
-- côté application : la base garantit au moins qu'il ne touche pas à celui d'un
-- camarade.
create policy "rendus_stagiaire" on public.devoirs_rendus
  for all to authenticated
  using (
    stagiaire_id in (
      select s.id from public.stagiaires s where s.user_id = auth.uid()
    )
  )
  with check (
    stagiaire_id in (
      select s.id from public.stagiaires s where s.user_id = auth.uid()
    )
    and exists (
      select 1 from public.devoirs d
      where d.id = devoirs_rendus.devoir_id
        and d.groupe_id = public.groupe_du_stagiaire()
    )
  );
