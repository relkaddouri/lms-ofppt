-- 036 — Paramètres de charge horaire du formateur.
--
-- Les 910 heures et les plafonds d'heures supplémentaires étaient écrits dans le
-- code. Ils relèvent du contrat, pas du produit : un formateur à temps partiel,
-- ou dont l'établissement applique un autre volume, doit pouvoir les saisir.
--
-- Les heures supplémentaires ne concernent pas tout le monde. Tant qu'elles ne
-- sont pas activées, leurs deux plafonds n'ont pas à encombrer le suivi.

create table if not exists public.parametres_formateur (
  id uuid primary key default gen_random_uuid(),
  formateur_id uuid not null unique default auth.uid()
    references auth.users (id) on delete cascade,
  heures_annuelles numeric(5, 1) not null default 910
    check (heures_annuelles > 0 and heures_annuelles <= 2000),
  heures_sup_actives boolean not null default false,
  plafond_sup_mensuel numeric(4, 1) not null default 30
    check (plafond_sup_mensuel >= 0 and plafond_sup_mensuel <= 200),
  plafond_sup_annuel numeric(5, 1) not null default 260
    check (plafond_sup_annuel >= 0 and plafond_sup_annuel <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.parametres_formateur is
  'Charge horaire contractuelle du formateur. Les valeurs par défaut sont celles du PRD §4.10, elles ne sont pas des constantes du produit.';
comment on column public.parametres_formateur.heures_sup_actives is
  'Faux tant que le formateur n''effectue pas d''heures supplémentaires : le suivi n''affiche alors ni le plafond mensuel ni l''annuel.';

alter table public.parametres_formateur enable row level security;

create policy "parametres_formateur_proprietaire" on public.parametres_formateur
  for all to authenticated
  using (formateur_id = auth.uid())
  with check (formateur_id = auth.uid());
