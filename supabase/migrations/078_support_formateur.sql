-- Un second support par séance, celui-là pour le formateur seul (PRD §4.4).
--
-- Le formateur prépare deux choses différentes et n'en remettait qu'une. Le
-- support du stagiaire est un document remis : il dit ce qu'il faut retenir.
-- Le sien porte ce qui ne se remet pas — la conduite de la séance, les
-- réponses attendues, ce qu'il projette pour lui. Il l'écrivait jusqu'ici dans
-- le support du stagiaire, faute d'endroit, ou pas du tout.
--
-- Une colonne plutôt qu'une table : c'est le même objet, avec les mêmes
-- versions, le même partage entre séances miroir, le même diaporama et les
-- mêmes PDF. Une seconde table aurait dupliqué le schéma, les policies et les
-- index — et les aurait laissés diverger au premier changement.

alter table public.supports_seance
  add column if not exists destinataire text not null default 'stagiaire'
    check (destinataire in ('stagiaire', 'formateur'));

comment on column public.supports_seance.destinataire is
  'À qui le support est destiné. « stagiaire » : remis, lisible dans son espace. « formateur » : privé, jamais servi à un stagiaire.';

-- L'unicité portait sur (seance_id, version) : les deux supports d'une même
-- séance se seraient disputé le numéro 1. Elle se lit maintenant par
-- destinataire, chacun ayant sa propre suite de versions.
--
-- La contrainte est retrouvée par sa définition et non par son nom : celui-ci
-- a été donné par Postgres à la création de la table, et le supposer serait le
-- laisser en place sans que rien ne le signale.
do $$
declare nom text;
begin
  select conname into nom
    from pg_constraint
   where conrelid = 'public.supports_seance'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) = 'UNIQUE (seance_id, version)';
  if nom is not null then
    execute format('alter table public.supports_seance drop constraint %I', nom);
  end if;
end $$;

alter table public.supports_seance
  drop constraint if exists supports_seance_destinataire_version_unique;
alter table public.supports_seance
  add constraint supports_seance_destinataire_version_unique
  unique (seance_id, destinataire, version);

drop index if exists public.supports_seance_idx;
create index if not exists supports_seance_idx
  on public.supports_seance (seance_id, destinataire, version desc);

-- Le garde-fou qui compte.
--
-- La condition d'appartenance est reprise mot pour mot de la migration 052 —
-- `seance_groupes`, et non `seances.groupe_id`, colonne supprimée depuis. Seul
-- le filtre sur le destinataire s'y ajoute.
--
-- Les requêtes de l'application filtrent bien sur `destinataire`, mais une
-- requête qui oublie le filtre ne doit pas suffire à montrer au stagiaire ce
-- qui ne lui est pas destiné. La policy le lui refuse, quoi que demande le
-- code : c'est ici, et pas dans un `select`, que « privé » est garanti.
drop policy if exists "supports_lecture_stagiaire" on public.supports_seance;
create policy "supports_lecture_stagiaire" on public.supports_seance
  for select to authenticated
  using (
    destinataire = 'stagiaire'
    and exists (
      select 1 from public.seance_groupes sg
      where sg.seance_id = supports_seance.seance_id
        and sg.groupe_id = groupe_du_stagiaire()
    )
  );
