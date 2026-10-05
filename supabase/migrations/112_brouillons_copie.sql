-- La copie en cours survit à la coupure réseau.
--
-- Jusqu'ici, ce que le stagiaire écrivait pendant l'épreuve ne vivait que
-- dans le stockage local de son navigateur. Cela le protégeait d'un
-- rechargement de page, et de rien d'autre : un ordinateur qui s'éteint, un
-- navigateur en navigation privée, un changement de poste, et le travail
-- était perdu. Surtout, le formateur ne recevait rien tant que la copie
-- n'était pas rendue — un stagiaire déconnecté avant la remise avait composé
-- pour personne.
--
-- Le brouillon est donc enregistré côté serveur pendant la composition. Il
-- n'est pas une copie rendue : `passations_controle` reste la table des
-- copies, et une ligne y apparaît toujours au moment de la remise, pas
-- avant. Les deux ne se confondent pas.
--
-- L'écriture vient du navigateur du stagiaire, directement, sans passer par
-- le serveur de l'application : une épreuve de deux heures et demie pour
-- seize stagiaires représenterait sinon plus de mille exécutions Vercel pour
-- de simples écritures.

create table if not exists public.brouillons_copie (
  controle_id uuid not null references public.controles(id) on delete cascade,
  stagiaire_id uuid not null references public.stagiaires(id) on delete cascade,
  -- Les réponses en cours, dans la même forme que `passations_controle.responses` :
  -- un objet dont les clés sont les identifiants de questions.
  reponses jsonb not null default '{}'::jsonb,
  maj_le timestamptz not null default now(),
  primary key (controle_id, stagiaire_id)
);

comment on table public.brouillons_copie is
  'La copie en cours d''un stagiaire, enregistrée pendant l''épreuve pour qu''une coupure réseau ne la perde pas. Distincte de passations_controle, qui ne contient que les copies rendues. Effacée à la remise.';

create index if not exists brouillons_copie_controle_idx
  on public.brouillons_copie (controle_id, maj_le desc);

alter table public.brouillons_copie enable row level security;

-- ── Le stagiaire écrit le sien, et le relit ────────────────────────────────
--
-- Relire est la moitié utile : c'est ainsi qu'il retrouve son travail en
-- revenant, depuis le même poste ou un autre.
--
-- Les trois verbes, pas deux : l'écriture se fait par `upsert`, qui se
-- traduit par « insert … on conflict do update » et exige de pouvoir lire la
-- ligne en conflit. C'est la faute des migrations 081 et 106, corrigée deux
-- fois ; elle ne se refera pas.
drop policy if exists "brouillons_depot" on public.brouillons_copie;
create policy "brouillons_depot" on public.brouillons_copie
  for insert to authenticated
  with check (
    exists (
      select 1 from public.stagiaires s
       where s.id = stagiaire_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "brouillons_maj" on public.brouillons_copie;
create policy "brouillons_maj" on public.brouillons_copie
  for update to authenticated
  using (
    exists (
      select 1 from public.stagiaires s
       where s.id = stagiaire_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "brouillons_lecture_stagiaire" on public.brouillons_copie;
create policy "brouillons_lecture_stagiaire" on public.brouillons_copie
  for select to authenticated
  using (
    exists (
      select 1 from public.stagiaires s
       where s.id = stagiaire_id and s.user_id = auth.uid()
    )
  );

-- ── Le formateur lit ceux de ses contrôles ─────────────────────────────────
--
-- C'est la réponse au cas qui a motivé cette table : un stagiaire déconnecté
-- qui n'a jamais rendu. Son travail existe, et le formateur peut le voir.
--
-- Il peut aussi l'effacer : un brouillon n'a pas à survivre à l'épreuve qu'il
-- accompagnait.
drop policy if exists "brouillons_lecture_formateur" on public.brouillons_copie;
create policy "brouillons_lecture_formateur" on public.brouillons_copie
  for select to authenticated
  using (public.peut_acceder_controle(controle_id));

drop policy if exists "brouillons_purge_formateur" on public.brouillons_copie;
create policy "brouillons_purge_formateur" on public.brouillons_copie
  for delete to authenticated
  using (public.peut_acceder_controle(controle_id));

-- Le stagiaire efface le sien en rendant sa copie : le brouillon n'a plus
-- d'objet une fois la remise acceptée.
drop policy if exists "brouillons_retrait_stagiaire" on public.brouillons_copie;
create policy "brouillons_retrait_stagiaire" on public.brouillons_copie
  for delete to authenticated
  using (
    exists (
      select 1 from public.stagiaires s
       where s.id = stagiaire_id and s.user_id = auth.uid()
    )
  );
