"use client";

import { useMemo, useState } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import StatusBadge from "@/components/StatusBadge";
import type { AuditEntry, Controle } from "@/app/actions/controles";

const inputClass =
  "w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    if (key === "id" || key === "module_id" || key === "token_public") continue;
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
          <span className="text-forest">{formatValue(c.apres)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function HistoriqueManager({
  moduleId,
  moduleNom,
  controles,
  entries,
}: {
  moduleId: string;
  moduleNom: string;
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

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: moduleNom, href: `/modules/${moduleId}` },
          { label: "Contrôle", href: `/modules/${moduleId}/controle` },
          { label: "Historique" },
        ]}
      />

      <div className="mt-6 flex max-w-[640px] items-center gap-3">
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

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-sm text-slate">
            Aucune modification enregistrée pour l&apos;instant. Les changements
            sur un contrôle validé apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-paper text-xs uppercase tracking-wide text-slate">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Contrôle</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Modifications</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-border transition-colors hover:bg-mint/50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate">
                    {fmtDate(e.date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {titreFor(e.ligne_id)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={actionTone(e.action)}>
                      {actionLabel(e.action)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <ChangesList entry={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
