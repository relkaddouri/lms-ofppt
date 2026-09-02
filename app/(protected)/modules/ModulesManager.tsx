"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createModule,
  updateModule,
  deleteModule,
  type CompetenceDisponible,
  type Module,
} from "@/app/actions/modules";
import KebabMenu from "@/components/KebabMenu";
import Button from "@/components/ui/Button";
import Input, { Textarea, inputStyles } from "@/components/ui/Input";
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { anneeDuCycle, libelleAnnee, libelleModule } from "@/lib/modules";

/** Choix « je saisis tout moi-même », pour un module hors programme officiel. */
const HORS_REFERENTIEL = "libre";

export default function ModulesManager({
  modules,
  competences,
}: {
  modules: Module[];
  competences: CompetenceDisponible[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [aSupprimer, setASupprimer] = useState<Module | null>(null);
  const [busy, setBusy] = useState(false);
  const [filtre, setFiltre] = useState("");
  const [annee, setAnnee] = useState("tous");
  const [form, setForm] = useState({
    nom: "",
    description: "",
    duree_reference: "",
  });
  const [competenceId, setCompetenceId] = useState<string>(HORS_REFERENTIEL);

  function openCreate() {
    setEditing(null);
    setCompetenceId(HORS_REFERENTIEL);
    setForm({ nom: "", description: "", duree_reference: "" });
    setOpen(true);
  }

  /**
   * Choisir une compétence remplit les trois champs depuis le référentiel.
   * Ils restent modifiables : la durée nationale est un repère, l'établissement
   * l'ajuste souvent.
   */
  function choisirCompetence(id: string) {
    setCompetenceId(id);
    if (id === HORS_REFERENTIEL) {
      setForm({ nom: "", description: "", duree_reference: "" });
      return;
    }
    const c = competences.find((x) => x.id === id);
    if (!c) return;
    setForm({
      nom: c.nom,
      description: `Décliné de la compétence ${c.numero}${
        c.codeOfficiel ? ` (${c.codeOfficiel})` : ""
      }`,
      duree_reference: c.dureeHeures != null ? String(c.dureeHeures) : "",
    });
  }

  function openEdit(m: Module) {
    setEditing(m);
    setCompetenceId(HORS_REFERENTIEL);
    setForm({
      nom: m.nom,
      description: m.description ?? "",
      duree_reference: String(m.duree_reference),
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const input = {
      nom: form.nom,
      description: form.description || null,
      duree_reference: Number(form.duree_reference) || 0,
    };
    try {
      if (editing) {
        await updateModule(editing.id, input);
        toast("Module modifié");
      } else {
        await createModule({
          ...input,
          competence_id:
            competenceId === HORS_REFERENTIEL ? null : competenceId,
        });
        toast("Module ajouté");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!aSupprimer) return;
    setBusy(true);
    try {
      await deleteModule(aSupprimer.id);
      setASupprimer(null);
      toast("Module supprimé");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  // Recherche côté client : la liste tient en mémoire, et le design system
  // exige un champ visible dès huit éléments (§11).
  const recherche = filtre.trim().toLowerCase();
  const visibles = modules.filter((m) => {
    const parAnnee =
      annee === "tous" || String(anneeDuCycle(m.cycle) ?? "") === annee;
    if (!parAnnee) return false;
    if (!recherche) return true;
    return [m.nom, m.code, m.description]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(recherche));
  });

  // Les années réellement présentes : un filtre qui ne filtre rien encombre.
  const annees = [
    ...new Set(
      modules
        .map((m) => anneeDuCycle(m.cycle))
        .filter((a): a is 1 | 2 => a !== null),
    ),
  ].sort();

  const heuresTotales = visibles.reduce((t, m) => t + m.duree_reference, 0);

  return (
    <div className="flex flex-col gap-6 px-6 py-10 md:px-10 md:pb-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Référentiel
          </span>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Modules
          </h1>
          <p className="text-base text-slate-2">
            <span className="font-mono text-body">{visibles.length}</span> module
            {visibles.length > 1 ? "s" : ""} ·{" "}
            <span className="font-mono text-body">{heuresTotales} h</span> de
            durée de référence
          </p>
        </div>
        <Button icon={Plus} onClick={openCreate}>
          Ajouter un module
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
      <label className="relative block min-w-[260px] flex-1 md:max-w-[420px]">
        <span className="sr-only">Rechercher un module</span>
        <Search
          size={17}
          strokeWidth={2}
          aria-hidden
          className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-slate-light"
        />
        <input
          type="search"
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Rechercher un code ou un intitulé de module…"
          className="w-full rounded-[9px] border border-border-strong bg-surface py-[11px] pl-10 pr-[13px] text-[15px] text-ink outline-none transition-colors duration-150 ease-out placeholder:text-slate-light focus:border-teal focus:shadow-[0_0_0_3px_rgba(46,125,158,0.15)]"
        />
      </label>

        {annees.length > 1 ? (
          <div className="flex gap-1 rounded-[11px] border border-border bg-wash-strong p-1">
            {[
              { valeur: "tous", libelle: "Tous" },
              ...annees.map((a) => ({
                valeur: String(a),
                libelle: libelleAnnee(a),
              })),
            ].map((o) => (
              <button
                key={o.valeur}
                type="button"
                onClick={() => setAnnee(o.valeur)}
                aria-pressed={annee === o.valeur}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150 ease-out ${
                  annee === o.valeur
                    ? "bg-surface text-ink shadow-[0_1px_2px_rgba(46,59,78,0.12)]"
                    : "text-slate-2 hover:text-ink"
                }`}
              >
                {o.libelle}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
        <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(120px,1fr)_minmax(96px,0.9fr)_52px] items-center gap-4 border-b border-border bg-paper-alt px-6 py-3.5">
          {["Module", "Durée de référence", "Groupes", ""].map((c, i) => (
            <span
              key={c || i}
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-light"
            >
              {c}
            </span>
          ))}
        </div>

        {visibles.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
            <span className="text-[15px] font-semibold text-ink">
              {modules.length === 0
                ? "Aucun module"
                : "Aucun module ne correspond"}
            </span>
            <span className="text-[13.5px] text-slate-light">
              {modules.length === 0
                ? "Ajoutez le premier module du référentiel."
                : "Essayez un autre code ou intitulé."}
            </span>
          </div>
        ) : (
          visibles.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[minmax(0,2.4fr)_minmax(120px,1fr)_minmax(96px,0.9fr)_52px] items-center gap-4 border-b border-separator px-6 py-4 transition-colors duration-150 ease-out last:border-0 hover:bg-paper"
            >
              <span className="flex min-w-0 items-center gap-3.5">
                <span className="flex h-9 shrink-0 items-center justify-center rounded-[9px] bg-wash px-2.5 font-mono text-xs font-semibold text-slate-2">
                  {m.code ?? "—"}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/modules/${m.id}`}
                    className="truncate text-[15.5px] font-semibold text-ink no-underline hover:no-underline"
                  >
                    {m.nom}
                  </Link>
                  {m.description ? (
                    <span className="truncate text-[13px] text-slate-light">
                      {m.description}
                    </span>
                  ) : null}
                </span>
              </span>

              <span className="font-mono text-[14.5px] text-body">
                {m.duree_reference} h
              </span>

              <span className="text-[14.5px] text-slate-2">
                {m.groupes === 0
                  ? "—"
                  : `${m.groupes} groupe${m.groupes > 1 ? "s" : ""}`}
              </span>

              <span className="flex justify-end">
                <KebabMenu
                  items={[
                    { label: "Modifier", onClick: () => openEdit(m), icon: Pencil },
                    {
                      label: "Supprimer",
                      onClick: () => setASupprimer(m),
                      danger: true,
                      icon: Trash2,
                    },
                  ]}
                />
              </span>
            </div>
          ))
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier le module" : "Ajouter un module"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {editing ? null : (
            <label htmlFor="competence" className="flex flex-col gap-[7px]">
              <span className="text-sm font-semibold text-body">
                Compétence du référentiel
              </span>
              <select
                id="competence"
                value={competenceId}
                onChange={(e) => choisirCompetence(e.target.value)}
                className={inputStyles}
              >
                <option value={HORS_REFERENTIEL}>
                  — Saisie libre, hors référentiel —
                </option>
                {competences.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} — ` : ""}
                    {c.nom}
                    {c.dureeHeures != null ? ` · ${c.dureeHeures} h` : ""}
                    {c.dejaDeclinee ? " (déjà déclinée)" : ""}
                  </option>
                ))}
              </select>
              <span className="text-[13px] text-slate-light">
                Les champs ci-dessous se remplissent depuis le programme
                officiel. Ajustez-les si votre établissement s&apos;en écarte.
              </span>
            </label>
          )}

          <Input
            id="nom"
            label="Nom"
            required
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
          />
          <Textarea
            id="description"
            label="Description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            id="duree"
            label="Durée (heures)"
            type="number"
            min={0}
            required
            value={form.duree_reference}
            onChange={(e) => setForm({ ...form, duree_reference: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" icon={X} onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              icon={Save}
              loading={busy}
              loadingLabel="Enregistrement…"
            >
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        onConfirm={handleDelete}
        busy={busy}
        title="Supprimer ce module ?"
        message={
          <>
            Supprimer définitivement «&nbsp;{aSupprimer?.nom}&nbsp;» ? Les fiches,
            contrôles et séances rattachés seront également supprimés.
          </>
        }
      />
    </div>
  );
}
