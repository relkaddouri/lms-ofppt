"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSeance, type ModeSeance } from "@/app/actions/seances";
import type { GroupeModuleInfo } from "@/app/actions/groupes";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input, { Textarea, inputStyles } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  BLOCS,
  PARTIES,
  creneauDe,
  dureeHeures,
  formatHeure,
  type BlocHoraire,
  type PartieBloc,
} from "@/lib/creneaux";
import { Plus } from "lucide-react";

export default function NouvelleSeanceForm({
  groupeId,
  modules,
}: {
  groupeId: string;
  modules: GroupeModuleInfo[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    moduleId: modules[0]?.module_id ?? "",
    date: new Date().toISOString().slice(0, 10),
    bloc: "matin" as BlocHoraire,
    partie: "complet" as PartieBloc,
    mode: "presentiel" as ModeSeance,
    objectif: "",
  });

  const creneau = creneauDe(form.bloc, form.partie);
  const duree = dureeHeures(creneau.debut, creneau.fin);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.moduleId) {
      toast("Aucun module assigné à ce groupe.", "error");
      return;
    }
    setBusy(true);
    try {
      await createSeance({
        groupeId,
        moduleId: form.moduleId,
        date: form.date,
        bloc: form.bloc,
        partie: form.partie,
        mode: form.mode,
        objectifOperationnel: form.objectif,
      });
      setForm((f) => ({ ...f, objectif: "" }));
      toast("Séance planifiée");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 max-w-[640px]">
      <h2 className="text-sm font-medium text-ink">Planifier une séance</h2>

      <form onSubmit={handleSubmit} className="mt-3 space-y-4">
        <div>
          <label htmlFor="module" className="block text-sm font-medium text-ink">
            Module
          </label>
          <select
            id="module"
            required
            value={form.moduleId}
            onChange={(e) => setForm({ ...form, moduleId: e.target.value })}
            className={inputStyles}
          >
            {modules.map((m) => (
              <option key={m.module_id} value={m.module_id}>
                {m.code_operationnel ? `${m.code_operationnel} — ` : ""}
                {m.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="date"
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <div>
            <label htmlFor="mode" className="block text-sm font-medium text-ink">
              Mode
            </label>
            <select
              id="mode"
              value={form.mode}
              onChange={(e) =>
                setForm({ ...form, mode: e.target.value as ModeSeance })
              }
              className={inputStyles}
            >
              <option value="presentiel">Présentiel</option>
              <option value="distance">À distance</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bloc" className="block text-sm font-medium text-ink">
              Bloc horaire
            </label>
            <select
              id="bloc"
              value={form.bloc}
              onChange={(e) =>
                setForm({ ...form, bloc: e.target.value as BlocHoraire })
              }
              className={inputStyles}
            >
              {(Object.keys(BLOCS) as BlocHoraire[]).map((b) => (
                <option key={b} value={b}>
                  {BLOCS[b].label} ({formatHeure(BLOCS[b].debut)} –{" "}
                  {formatHeure(BLOCS[b].fin)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="partie" className="block text-sm font-medium text-ink">
              Découpage
            </label>
            <select
              id="partie"
              value={form.partie}
              onChange={(e) =>
                setForm({ ...form, partie: e.target.value as PartieBloc })
              }
              className={inputStyles}
            >
              {PARTIES.map((p) => (
                <option key={p.valeur} value={p.valeur}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-slate">
          Créneau retenu :{" "}
          <span className="font-mono text-ink">
            {formatHeure(creneau.debut)} – {formatHeure(creneau.fin)}
          </span>{" "}
          soit <span className="font-mono text-ink">{duree} h</span>. La pause de
          15 min ({formatHeure(BLOCS[form.bloc].pause.debut)}) n&apos;interrompt
          pas une séance gardée entière.
        </p>

        <Textarea
          id="objectif"
          label="Objectif opérationnel"
          rows={2}
          value={form.objectif}
          onChange={(e) => setForm({ ...form, objectif: e.target.value })}
          placeholder="Ce que la séance doit permettre d'atteindre…"
          hint="Prévision saisie en amont, reprise du cahier du formateur."
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            icon={Plus}
            loading={busy}
            loadingLabel="Planification…"
            disabled={modules.length === 0}
          >
            Planifier
          </Button>
        </div>
      </form>
    </Card>
  );
}
