"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createGroupe,
  type Groupe,
  type Specialite,
} from "@/app/actions/groupes";
import type { Module } from "@/app/actions/modules";
import Button from "@/components/ui/Button";
import Input, { inputStyles } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatDateJour } from "@/lib/format";
import { Plus, Search, X } from "lucide-react";
import { anneeDuCycle, libelleAnnee, libelleModule } from "@/lib/modules";

/** Numéro court d'un groupe : les chiffres de fin de son nom. */
function numeroDe(nom: string): string {
  return nom.match(/(\d{2,4})$/)?.[1] ?? nom.slice(0, 2).toUpperCase();
}

export default function GroupesManager({
  groupes,
  modules,
  specialites,
  anneeLibelle,
}: {
  groupes: Groupe[];
  modules: Module[];
  specialites: Specialite[];
  /**
   * L'année scolaire sélectionnée, telle qu'affichée en bandeau. Déduite de la
   * date du jour, elle contredisait le sélecteur (PRD §4.15).
   */
  anneeLibelle: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [filtre, setFiltre] = useState("");
  const [annee, setAnnee] = useState("tous");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    annee: "1",
    specialite_id: "",
  });
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  function toggleModule(id: string) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createGroupe({
        nom: form.nom,
        annee: Number(form.annee) || null,
        specialite_id: form.specialite_id || null,
        module_ids: selectedModules,
      });
      setOpen(false);
      setForm({ nom: "", annee: "1", specialite_id: "" });
      setSelectedModules([]);
      toast("Groupe créé");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  const recherche = filtre.trim().toLowerCase();
  const visibles = groupes.filter((g) => {
    const parAnnee = annee === "tous" || String(g.annee ?? "") === annee;
    const parTexte =
      !recherche ||
      [g.nom, g.specialite]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(recherche));
    return parAnnee && parTexte;
  });

  const totalStagiaires = visibles.reduce(
    (t, g) => t + (g.stagiaires?.[0]?.count ?? 0),
    0,
  );

  // Les modules proposés suivent l'année du groupe : une 2ᵉ année ne suit pas
  // les compétences du tronc commun. Les modules hors référentiel — sans
  // cycle, comme les transversaux — restent proposés dans les deux cas.
  const anneeChoisie = Number(form.annee) || 1;
  const modulesDeLAnnee = modules.filter((m) => {
    const a = anneeDuCycle(m.cycle);
    return a === null || a === anneeChoisie;
  });

  // Les années présentes dans les données, pour ne pas proposer un filtre vide.
  const annees = [
    ...new Set(groupes.map((g) => g.annee).filter((a): a is number => a !== null)),
  ].sort();

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-10 md:py-10 md:pb-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Année de formation {anneeLibelle}
          </span>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Groupes
          </h1>
          <p className="text-base text-slate-2">
            <span className="font-mono text-body">{visibles.length}</span> groupe
            {visibles.length > 1 ? "s" : ""} ·{" "}
            <span className="font-mono text-body">{totalStagiaires}</span>{" "}
            stagiaire{totalStagiaires > 1 ? "s" : ""}
          </p>
        </div>
        <Button icon={Plus} onClick={() => setOpen(true)}>
          Créer un groupe
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[280px] flex-1 md:max-w-[420px]">
          <span className="sr-only">Rechercher un groupe</span>
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
            placeholder="Rechercher un groupe ou une spécialité…"
            className="w-full rounded-[9px] border border-border-strong bg-surface py-[11px] pl-10 pr-[13px] text-[15px] text-ink outline-none transition-colors duration-150 ease-out placeholder:text-slate-light focus:border-teal focus:shadow-[0_0_0_3px_rgba(46,125,158,0.15)]"
          />
        </label>

        {annees.length > 1 ? (
          <div className="flex gap-1 rounded-[11px] border border-border bg-wash-strong p-1">
            {[
              { valeur: "tous", libelle: "Tous" },
              ...annees.map((a) => ({
                valeur: String(a),
                libelle: a === 1 ? "1ʳᵉ année" : `${a}ᵉ année`,
              })),
            ].map((o) => (
              <button
                key={o.valeur}
                type="button"
                onClick={() => setAnnee(o.valeur)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150 ease-out ${
                  annee === o.valeur
                    ? "bg-surface text-ink shadow-[0_1px_2px_rgba(46,59,78,0.12)]"
                    : "text-slate hover:text-ink"
                }`}
              >
                {o.libelle}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] md:gap-5">
        {visibles.length === 0 ? (
          <div className="col-span-full flex flex-col items-center gap-1 rounded-[14px] border border-border bg-surface px-6 py-14 text-center shadow-repos">
            <span className="text-[15px] font-semibold text-ink">
              {groupes.length === 0
                ? "Aucun groupe"
                : "Aucun groupe ne correspond"}
            </span>
            <span className="text-[13.5px] text-slate-light">
              {groupes.length === 0
                ? "Créez le premier groupe pour commencer."
                : "Essayez un autre nom ou changez de filtre."}
            </span>
          </div>
        ) : (
          visibles.map((g) => {
            const effectif = g.stagiaires?.[0]?.count ?? 0;
            return (
              <Link
                key={g.id}
                href={`/groupes/${g.id}`}
                className="flex min-w-0 flex-col gap-[18px] rounded-[14px] border border-border bg-surface p-5 no-underline shadow-repos transition-colors duration-150 ease-out hover:border-border-strong hover:no-underline"
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="flex h-9 shrink-0 items-center justify-center rounded-[9px] bg-ink px-2.5 font-mono text-xs font-semibold text-white">
                    {numeroDe(g.nom)}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate text-[17px] font-semibold text-ink">
                      {g.nom}
                    </span>
                    <span className="text-[13.5px] text-slate">
                      {g.annee
                        ? `${g.annee === 1 ? "1ʳᵉ" : `${g.annee}ᵉ`} année`
                        : "Année non précisée"}
                      {" · "}
                      {effectif} stagiaire{effectif > 1 ? "s" : ""}
                    </span>
                    {g.specialite ? (
                      <span className="truncate text-[13px] text-slate-light">
                        {g.specialite}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-separator pt-[18px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13.5px] text-slate">
                      Période de formation
                    </span>
                    <span className="font-mono text-[13px] text-body">
                      {g.date_debut
                        ? `${formatDate(g.date_debut)} → ${formatDateJour(g.date_fin, { court: true })}`
                        : "emploi du temps à générer"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Créer un groupe">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="nom"
            label="Nom"
            required
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
          />
          {/* Les dates de début et de fin ne se saisissent plus : elles se
              lisent sur les séances que le motif hebdomadaire a placées. */}
          <label htmlFor="annee" className="flex flex-col gap-[7px]">
            <span className="text-sm font-semibold text-body">
              Année de formation
            </span>
            <select
              id="annee"
              value={form.annee}
              onChange={(e) => {
                setForm({ ...form, annee: e.target.value, specialite_id: "" });
                // Un module coché puis rendu invisible par le changement
                // d'année serait assigné sans que rien ne le montre.
                setSelectedModules([]);
              }}
              className={inputStyles}
            >
              <option value="1">1ʳᵉ année — tronc commun</option>
              <option value="2">2ᵉ année — spécialisation</option>
            </select>
            <span className="text-[13px] text-slate-light">
              La période du groupe se calculera depuis son emploi du temps.
            </span>
          </label>

          {/* Une 2ᵉ année est rattachée à une spécialité : c'est ce que la
              base exige, et ce que le formulaire omettait — la création
              échouait sans que rien ne le dise. */}
          {form.annee === "2" ? (
            <label htmlFor="specialite" className="flex flex-col gap-[7px]">
              <span className="text-sm font-semibold text-body">
                Spécialité
              </span>
              <select
                id="specialite"
                required
                value={form.specialite_id}
                onChange={(e) =>
                  setForm({ ...form, specialite_id: e.target.value })
                }
                className={inputStyles}
              >
                <option value="">— Choisir une spécialité —</option>
                {specialites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div>
            <span className="block text-sm font-medium text-ink">
              Modules suivis
            </span>
            {modulesDeLAnnee.length === 0 ? (
              <p className="mt-1 text-xs text-slate">
                {modules.length === 0
                  ? "Aucun module disponible. Créez d'abord des modules dans la page Modules."
                  : `Aucun module de ${libelleAnnee(Number(form.annee))} dans votre référentiel.`}
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {modulesDeLAnnee.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-ink/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(m.id)}
                      onChange={() => toggleModule(m.id)}
                      className="h-4 w-4 accent-ink"
                    />
                    <span className="text-ink">{libelleModule(m.code, m.nom)}</span>
                    <span className="ml-auto font-mono text-xs text-slate">
                      {m.duree_reference}h
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" icon={X} onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              icon={Plus}
              loading={busy}
              loadingLabel="Création…"
            >
              Créer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
