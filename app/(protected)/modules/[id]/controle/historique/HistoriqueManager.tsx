"use client";

import { useMemo, useState } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import Badge from "@/components/ui/Badge";
import type { AuditEntry, Controle } from "@/app/actions/controles";
import { inputStyles } from "@/components/ui/Input";
import ListeCartes, { type Colonne } from "@/components/ui/ListeCartes";
import { formatDateTime } from "@/lib/format";
import { libelleModule } from "@/lib/modules";

const inputClass = inputStyles;

function actionTone(action: string): "success" | "info" | "danger" {
  if (action === "INSERT") return "success";
  if (action === "DELETE") return "danger";
  return "info";
}

function actionLabel(action: string) {
  if (action === "INSERT") return "Création";
  if (action === "DELETE") return "Suppression";
  return "Modification";
}

function formatValue(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function ChangesList({
  entry,
}: {
  entry: AuditEntry;
}) {
  if (entry.action === "INSERT") {
    return (
      <p className="text-sm text-ink">
        Contrôle créé
        {entry.nouvelle_valeur?.titre
          ? ` : ${formatValue(entry.nouvelle_valeur.titre)}`
          : ""}
        .
      </p>
    );
  }

  if (entry.action === "DELETE") {
    return (
      <p className="text-sm text-ink">
        Contrôle supprimé
        {entry.ancienne_valeur?.titre
          ? ` : ${formatValue(entry.ancienne_valeur.titre)}`
          : ""}
        .
      </p>
    );
  }

  const oldRow = entry.ancienne_valeur ?? {};
  const newRow = entry.nouvelle_valeur ?? {};
  const keys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);

  const changed: { key: string; avant: unknown; apres: unknown }[] = [];
  for (const key of keys) {
    if (key === "id" || key === "module_id") continue;
    if (JSON.stringify(oldRow[key]) !== JSON.stringify(newRow[key])) {
      changed.push({ key, avant: oldRow[key], apres: newRow[key] });
    }
  }

  if (!changed.length) {
    return <p className="text-sm text-slate">Aucun champ modifié.</p>;
  }

  return (
    <ul className="space-y-1">
      {changed.map((c) => (
        <li key={c.key} className="text-sm text-ink">
          <span className="font-medium">{c.key}</span> :{" "}
          <span className="text-slate line-through">
            {formatValue(c.avant)}
          </span>{" "}
          →{" "}
          <span className="text-ink">{formatValue(c.apres)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function HistoriqueManager({
  moduleId,
  moduleNom,
  moduleCode,
  controles,
  entries,
}: {
  moduleId: string;
  moduleNom: string;
  moduleCode: string | null;
  controles: Controle[];
  entries: AuditEntry[];
}) {
  const [controleId, setControleId] = useState<string>("all");

  const filtered = useMemo(() => {
    if (controleId === "all") return entries;
    return entries.filter((e) => e.ligne_id === controleId);
  }, [controleId, entries]);

  const titreFor = (id: string) =>
    controles.find((c) => c.id === id)?.titre ?? "Contrôle supprimé";

  /**
   * Le tableau devient une carte par ligne sous 768px (design_system §3bis).
   *
   * Le titre du contrôle porte la ligne, la date et l'action le qualifient,
   * et le détail des champs modifiés — la seule colonne qui puisse tenir sur
   * plusieurs lignes — passe en bas de carte.
   */
  const colonnes: Colonne<AuditEntry>[] = [
    {
      cle: "controle",
      entete: "Contrôle",
      role: "titre",
      cellule: (e) => titreFor(e.ligne_id),
    },
    {
      cle: "date",
      entete: "Date",
      role: "meta",
      cellule: (e) => (
        <span className="font-mono text-xs text-slate">
          {formatDateTime(e.date)}
        </span>
      ),
    },
    {
      cle: "action",
      entete: "Action",
      role: "meta",
      cellule: (e) => (
        <Badge tone={actionTone(e.action)}>{actionLabel(e.action)}</Badge>
      ),
    },
    {
      cle: "modifications",
      entete: "Modifications",
      pleineLargeur: true,
      cellule: (e) => <ChangesList entry={e} />,
    },
  ];

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: libelleModule(moduleCode, moduleNom), href: `/modules/${moduleId}` },
          { label: "Contrôle", href: `/modules/${moduleId}/controle` },
          { label: "Historique" },
        ]}
      />

      <div className="mt-6 flex max-w-[640px] flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
        <label htmlFor="controle" className="text-sm font-medium text-ink">
          Contrôle
        </label>
        <select
          id="controle"
          value={controleId}
          onChange={(e) => setControleId(e.target.value)}
          className={inputClass}
        >
          <option value="all">Tous les contrôles</option>
          {controles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titre ?? "Sans titre"}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <ListeCartes
          lignes={filtered}
          cle={(e) => e.id}
          colonnes={colonnes}
          vide="Aucune modification enregistrée pour l'instant. Les changements sur un contrôle validé apparaîtront ici."
        />
      </div>
    </div>
  );
}
