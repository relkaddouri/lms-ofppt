"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import {
  bulkImportStagiaires,
  type StagiaireImportRow,
} from "@/app/actions/stagiaires";
import { useToast } from "@/components/ui/Toast";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { initials } from "@/lib/format";
import { Check, Upload, X } from "lucide-react";

type ParsedRow = {
  nom: string;
  prenom: string;
  email: string;
  valid: boolean;
  error?: string;
};

function getField(raw: Record<string, string>, key: string) {
  const lower = key.toLowerCase();
  const entry = Object.entries(raw).find(
    ([k]) => k.trim().toLowerCase() === lower,
  );
  return entry ? (entry[1] ?? "").trim() : "";
}

export default function StagiaireCsvImport({
  groupeId,
}: {
  groupeId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function handleFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    setNotice(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        if (results.errors.length) {
          setParseError(
            results.errors
              .slice(0, 3)
              .map((e) => e.message)
              .join(" — "),
          );
        }

        const parsed: ParsedRow[] = results.data.map((raw) => {
          const nom = getField(raw, "nom");
          const prenom = getField(raw, "prenom");
          const email = getField(raw, "email");

          const errors: string[] = [];
          if (!nom) errors.push("nom manquant");
          if (!prenom) errors.push("prenom manquant");
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            errors.push("email invalide");

          return {
            nom,
            prenom,
            email,
            valid: errors.length === 0,
            error: errors.length ? errors.join(", ") : undefined,
          };
        });

        setRows(parsed);
      },
    });
  }

  function handleCancel() {
    setRows([]);
    setFileName(null);
    setParseError(null);
    setNotice(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleImport() {
    const validRows: StagiaireImportRow[] = rows
      .filter((r) => r.valid)
      .map((r) => ({ nom: r.nom, prenom: r.prenom, email: r.email || null }));

    if (!validRows.length) return;

    setBusy(true);
    try {
      const { imported } = await bulkImportStagiaires(groupeId, validRows);
      setNotice(
        `${imported} stagiaire(s) importé(s) avec succès.`,
      );
      toast("Stagiaires importés");
      handleCancel();
      router.refresh();
    } catch (err) {
      setNotice(null);
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  const validCount = rows.filter((r) => r.valid).length;

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="secondary"
          size="sm"
          icon={Upload}
          onClick={() => inputRef.current?.click()}
        >
          Importer depuis un CSV
        </Button>
        <span className="text-xs text-slate">
          Colonnes attendues : <span className="font-mono">nom, prenom, email</span>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {notice ? (
        <p className="mt-3 rounded-xl border border-tint-green bg-success-wash px-3 py-2 text-sm text-green-dark">
          {notice}
        </p>
      ) : null}

      {parseError ? (
        <p className="mt-3 rounded-xl border border-tint-alert-strong bg-alert-wash px-3 py-2 text-sm text-coral-dark">
          {parseError}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">
              {fileName} —{" "}
              <span className="font-mono text-slate">
                {validCount}/{rows.length} ligne(s) valide(s)
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" icon={X} onClick={handleCancel}>
                Annuler
              </Button>
              <Button
                icon={Check}
                onClick={handleImport}
                disabled={validCount === 0}
                loading={busy}
                loadingLabel="Import…"
              >
                Confirmer l&apos;import
              </Button>
            </div>
          </div>

          <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-paper">
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                  <th className="px-4 py-2 font-medium">Stagiaire</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border transition-colors hover:bg-wash/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-wash text-xs font-semibold text-ink focus-visible:ring-2 focus-visible:ring-mint">
                          {initials(r.prenom, r.nom)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {r.prenom} {r.nom}
                          </p>
                          <p className="truncate text-xs text-slate">
                            {r.email || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {r.valid ? (
                        <Badge tone="success">OK</Badge>
                      ) : (
                        <Badge tone="danger">{r.error}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
