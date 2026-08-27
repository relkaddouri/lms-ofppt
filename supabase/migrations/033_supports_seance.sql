-- 033 — Support de cours ou énoncé de TP d'une séance.
--
-- La fiche de préparation dit au formateur ce qu'il fait. Le support est ce
-- qu'il remet au stagiaire : un document de cours pour une séance théorique,
-- un énoncé de travaux pratiques pour une séance pratique. Ce sont deux
-- documents de nature différente, produits à partir du même objectif
-- d'apprentissage — d'où le type porté par la ligne.

create table if not exists public.supports_seance (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances (id) on delete cascade,
  type text not null check (type in ('theorique', 'pratique')),
  contenu jsonb not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  -- Une séance, un support, historisé par version — même règle que la fiche.
  unique (seance_id, version)
);

comment on table public.supports_seance is
  'Support remis au stagiaire : cours pour une séance théorique, énoncé de TP pour une séance pratique.';

create index if not exists supports_seance_idx
  on public.supports_seance (seance_id, version desc);

alter table public.supports_seance enable row level security;

create policy "supports_proprietaire" on public.supports_seance
  for all to authenticated
  using (
    public.peut_acceder_groupe(
      (select s.groupe_id from public.seances s where s.id = seance_id)
    )
  )
  with check (
    public.peut_acceder_groupe(
      (select s.groupe_id from public.seances s where s.id = seance_id)
    )
  );
