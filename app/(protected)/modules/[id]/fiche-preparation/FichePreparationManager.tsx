"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { saveFiche, type FichePreparation } from "@/app/actions/fiches";
import { useToast } from "@/components/ui/Toast";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/ui/Button";
import { slugify } from "@/lib/format";
import { Download, Save, Sparkles } from "lucide-react";

export default function FichePreparationManager({
  moduleId,
  moduleNom,
  moduleDuree,
  versions,
}: {
  moduleId: string;
  moduleNom: string;
  moduleDuree: number;
  versions: FichePreparation[];
}) {
  const router = useRouter();
  const [contenu, setContenu] = useState(versions[0]?.contenu ?? "");
  const [activeVersion, setActiveVersion] = useState<number | null>(
    versions[0]?.version ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "apercu">("apercu");
  const pdfRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  async function handleDownloadPdf() {
    const el = pdfRef.current;
    if (!el || !contenu.trim()) return;

    setBusy(true);
    try {
      await document.fonts.ready;

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageW = 210;
      const pageH = 297;
      const margin = 0;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;

      let heightLeft = imgH;
      let position = margin;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        margin,
        position,
        imgW,
        imgH,
      );
      heightLeft -= pageH - margin * 2;

      while (heightLeft > 0) {
        position -= pageH - margin * 2;
        pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          margin,
          position,
          imgW,
          imgH,
        );
        heightLeft -= pageH - margin * 2;
      }

      const safeName = slugify(moduleNom, "fiche");
      pdf.save(`fiche-${safeName}.pdf`);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Erreur de génération du PDF",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/generate/fiche-preparation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de génération");
      setContenu(data.contenu);
      setActiveVersion(null);
      setNotice("Fiche générée. Enregistrez-la pour créer une nouvelle version.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!contenu.trim()) {
      toast("Le contenu est vide.", "error");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const version = await saveFiche(moduleId, contenu);
      setActiveVersion(version);
      setNotice(`Version ${version} enregistrée.`);
      toast("Fiche enregistrée");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  function loadVersion(v: FichePreparation) {
    setActiveVersion(v.version);
    setContenu(v.contenu ?? "");
    setNotice(
      v.version === versions[0]?.version
        ? null
        : `Affichage de la version ${v.version} (ancienne version).`,
    );
  }

  const latestVersion = versions[0]?.version ?? null;
  const isViewingOld =
    activeVersion !== null && latestVersion !== null && activeVersion < latestVersion;

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: moduleNom, href: `/modules/${moduleId}` },
          { label: "Fiche de préparation" },
        ]}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button icon={Save} onClick={handleSave} disabled={busy}>
          Enregistrer une nouvelle version
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={Sparkles}
          onClick={handleGenerate}
          loading={busy}
          loadingLabel="Génération…"
        >
          Générer avec l&apos;IA
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={Download}
          onClick={handleDownloadPdf}
          disabled={!contenu.trim()}
          loading={busy}
          loadingLabel="Génération du PDF…"
        >
          Télécharger en PDF
        </Button>
      </div>

      {notice ? (
        <p className="mt-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}

      {isViewingOld ? (
        <p className="mt-4 rounded-xl border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
          Vous consultez une ancienne version. Enregistrer créera une nouvelle
          version à partir de son contenu.
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <h2 className="text-sm font-medium text-ink">Versions</h2>
          {versions.length === 0 ? (
            <p className="mt-2 text-xs text-slate">Aucune version enregistrée.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => loadVersion(v)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-forest ${
                      activeVersion === v.version
                        ? "border-forest bg-mint text-ink"
                        : "border-border text-slate hover:border-forest/50"
                    }`}
                  >
                    <span className="font-mono">v{v.version}</span>
                    <span className="mt-0.5 block text-xs text-slate">
                      {new Date(v.created_at).toLocaleString("fr-FR")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <div className="flex items-center justify-between">
            <label htmlFor="contenu" className="text-sm font-medium text-ink">
              Contenu
            </label>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button
                onClick={() => setMode("edit")}
                className={`rounded-[5px] px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-forest ${
                  mode === "edit"
                    ? "bg-mint text-forest"
                    : "text-slate hover:text-ink"
                }`}
              >
                Éditeur
              </button>
              <button
                onClick={() => setMode("apercu")}
                className={`rounded-[5px] px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-forest ${
                  mode === "apercu"
                    ? "bg-mint text-forest"
                    : "text-slate hover:text-ink"
                }`}
              >
                Aperçu
              </button>
            </div>
          </div>

          {mode === "edit" ? (
            <textarea
              id="contenu"
              rows={26}
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="Cliquez sur « Générer avec l'IA » ou saisissez la fiche."
            />
          ) : (
            <div className="md-view mt-2 max-h-[520px] overflow-auto rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-4">
              {contenu.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {contenu}
                </ReactMarkdown>
              ) : (
                <p className="text-sm text-slate">
                  Aucun contenu à afficher.
                </p>
              )}
            </div>
          )}
          <div className="mt-2 flex justify-between text-xs text-slate">
            <span>
              Dernière version :{" "}
              <span className="font-mono">{latestVersion ?? "—"}</span>
            </span>
            <span>{contenu.length} caractères</span>
          </div>
        </div>
      </div>

      <div className="pdf-capture" ref={pdfRef} aria-hidden>
        <div className="px-10 py-8">
          <div className="pdf-doc-header">
            <div>
              <div className="pdf-brand">OFPPT</div>
              <div className="pdf-org">
                Office de la Formation Professionnelle et de la Promotion du Travail
              </div>
              <div className="pdf-org-sub">Royaume du Maroc</div>
            </div>
            <div className="pdf-ref">
              <div>Réf. : {moduleId.slice(0, 8)}</div>
              <div>v{latestVersion ?? 1}</div>
            </div>
          </div>

          <h1 className="pdf-title">Fiche de préparation</h1>
          <p className="pdf-module">{moduleNom}</p>

          <table className="pdf-meta">
            <tbody>
              <tr>
                <th>Durée prévue</th>
                <td>{moduleDuree} heures</td>
                <th>Version</th>
                <td>v{latestVersion ?? 1}</td>
              </tr>
              <tr>
                <th>Date</th>
                <td>{new Date().toLocaleDateString("fr-FR")}</td>
                <th>Statut</th>
                <td>Brouillon</td>
              </tr>
            </tbody>
          </table>

          <div className="md-view pdf-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {contenu || "*Aucun contenu.*"}
            </ReactMarkdown>
          </div>

          <div className="pdf-footer">
            LMS OFPPT — Fiche de préparation pédagogique
          </div>
        </div>
      </div>
    </div>
  );
}
