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
import { Check, Upload, X } from "lucide-react";

type ParsedRow = {
  nom: string;
  prenom: string;
  email: string;
  valid: boolean;
  error?: string;
};

const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper focus:outline-none focus:ring-2 focus:ring-forest";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 focus:outline-none focus:ring-2 focus:ring-forest";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-slate hover:bg-slate/10 focus:outline-none focus:ring-2 focus:ring-forest";

function getField(raw: Record<string, string>, key: string) {
  const lower = key.toLowerCase();
  const entry = Object.entries(raw).find(
    ([k]) => k.trim().toLowerCase() === lower,
  );
  return entry ? (entry[1] ?? "").trim() : "";
}

function initials(prenom: string, nom: string) {
  const a = prenom.trim().charAt(0);
  const b = nom.trim().charAt(0);
  const out = `${a}${b}`.toUpperCase();
  return out || "?";
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
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  const validCount = rows.filter((r) => r.valid).length;

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => inputRef.current?.click()}
          className={btnSecondary}
        >
          <Upload size={16} />
          Importer depuis un CSV
        </button>
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
        <p className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}

      {parseError ? (
        <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
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
              <button onClick={handleCancel} className={btnGhost}>
                <X size={16} />
                Annuler
              </button>
              <button
                onClick={handleImport}
                disabled={busy || validCount === 0}
                className={btnPrimary}
              >
                {busy ? (
                  "Import…"
                ) : (
                  <>
                    <Check size={16} />
                    Confirmer l&apos;import
                  </>
                )}
              </button>
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
                  <tr key={i} className="border-t border-border transition-colors hover:bg-mint/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-mint text-xs font-semibold text-forest focus-visible:ring-2 focus-visible:ring-mint">
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
    </div>
  );
}
