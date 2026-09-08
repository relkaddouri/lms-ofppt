"use client";

import { useEffect, useRef, useState } from "react";
import { getPassations, type Passation } from "@/app/actions/controles";
import Link from "next/link";
import { ClipboardList, FileSignature, Files, PenLine } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button, { buttonStyles } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

import { formatDateTime } from "@/lib/format";
import {
  telechargerEmargement,
  telechargerLotResultats,
  telechargerResultatSigne,
} from "@/lib/telecharger-resultat";

function noteTone(note: number): "success" | "info" | "danger" {
  if (note >= 10) return "success";
  if (note >= 5) return "info";
  return "danger";
}

export default function CopiesManager({
  controleId,
  controleTitre,
  moduleNom,
  moduleId,
  groupeId,
  totalAttendu,
}: {
  controleId: string;
  controleTitre: string;
  moduleNom: string;
  moduleId: string;
  groupeId: string;
  /** 20 pour un CC, 40 pour un EFM (PRD §4.7). */
  totalAttendu: number;
}) {
  const [passations, setPassations] = useState<Passation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySigne, setBusySigne] = useState(false);
  const [busyLot, setBusyLot] = useState<"lot" | "emargement" | null>(null);
  // Coché par défaut : le dossier remis à l'administration s'ouvre sur la
  // présence. Le formateur qui n'imprime que pour rendre les copies décoche.
  const [avecEmargement, setAvecEmargement] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const selected = passations.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPassations(controleId)
      .then((data) => {
        if (cancelled) return;
        setPassations(data);
        setSelectedId((prev) =>
          prev && data.some((p) => p.id === prev) ? prev : data[0]?.id ?? null,
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [controleId]);



  /**
   * Le résultat à signer, depuis la liste des copies.
   *
   * Le même document que sur l'écran de correction, par le même chemin : le
   * formateur qui vient de publier une série de copies les édite ici, l'une
   * après l'autre, sans repasser par la correction de chacune.
   */
  async function handleResultatSigne() {
    if (!selected) return;
    setBusySigne(true);
    try {
      const fait = await telechargerResultatSigne(selected.id);
      if (!fait) {
        toast(
          "Publiez d'abord le résultat, depuis l'écran de correction.",
          "error",
        );
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Erreur de génération du PDF",
        "error",
      );
    } finally {
      setBusySigne(false);
    }
  }

  /** Toutes les copies publiées, en un fichier. */
  async function handleLot() {
    setBusyLot("lot");
    try {
      const nombre = await telechargerLotResultats(controleId, avecEmargement);
      if (nombre === 0) {
        toast("Aucun résultat publié pour ce contrôle.", "error");
      } else {
        toast(
          `${nombre} résultat${nombre > 1 ? "s" : ""} dans un seul fichier.`,
        );
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Erreur de génération du PDF",
        "error",
      );
    } finally {
      setBusyLot(null);
    }
  }

  /** La feuille d'émargement seule, imprimable avant l'épreuve. */
  async function handleEmargement() {
    setBusyLot("emargement");
    try {
      const fait = await telechargerEmargement(controleId);
      if (!fait) toast("Contrôle introuvable.", "error");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Erreur de génération du PDF",
        "error",
      );
    } finally {
      setBusyLot(null);
    }
  }

  return (
    <div>
      {error ? (
        <p className="rounded-xl border border-tint-alert-strong bg-alert-wash px-3 py-2 text-sm text-coral-dark">
          {error}
        </p>
      ) : loading ? (
        <p className="text-sm text-slate">Chargement des copies…</p>
      ) : passations.length === 0 ? (
        <p className="rounded-[14px] border border-border bg-surface shadow-repos p-4 text-sm text-slate">
          Aucune copie rendue pour l&apos;instant. Les stagiaires composent depuis
          leur espace, une fois le contrôle validé.
        </p>
      ) : (
        <>
        {/* ── Le dossier complet ────────────────────────────────────────
            Deux documents que l'administration attend ensemble : qui était
            présent, puis ce que chacun a obtenu. Ils vivent au-dessus de la
            liste parce qu'ils portent sur le contrôle entier, pas sur la
            copie sélectionnée. */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-surface p-[18px] shadow-repos">
          <Button
            variant="secondary"
            size="sm"
            icon={Files}
            onClick={handleLot}
            loading={busyLot === "lot"}
            loadingLabel="Assemblage…"
          >
            Toutes les copies (PDF)
          </Button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={avecEmargement}
              onChange={(e) => setAvecEmargement(e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            Joindre la feuille d&apos;émargement en tête
          </label>
          <Button
            variant="ghost"
            size="sm"
            icon={ClipboardList}
            onClick={handleEmargement}
            loading={busyLot === "emargement"}
            loadingLabel="Génération…"
            className="ml-auto"
          >
            Feuille d&apos;émargement seule
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
          <div className="rounded-[14px] border border-border bg-surface shadow-repos p-3">
            <h2 className="px-1 text-sm font-medium text-ink">
              Copies ({passations.length})
            </h2>
            <ul className="mt-2 space-y-1">
              {passations.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left hover:bg-slate/5 focus:outline-none focus:ring-2 focus:ring-ink ${
                      p.id === selectedId ? "bg-wash text-ink" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {p.nom_complet}
                      </span>
                      <Badge tone={noteTone(Number(p.note) || 0)}>
                        {Number(p.note) || 0} / {totalAttendu}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate">
                      {formatDateTime(p.submitted_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selected ? (
            <div className="rounded-[14px] border border-border bg-surface shadow-repos p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">
                    {selected.nom_complet}
                  </h2>
                  <p className="text-xs text-slate">
                    {selected.email ? `${selected.email} · ` : ""}
                    {formatDateTime(selected.submitted_at)}
                  </p>
                </div>
                {/* Le résultat n'a de sens qu'une fois publié : le bouton
                    n'apparaît donc qu'à ce moment-là plutôt que de mener à un
                    refus. */}
                {selected.publie_le ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={FileSignature}
                    onClick={handleResultatSigne}
                    loading={busySigne}
                    loadingLabel="Génération…"
                  >
                    Résultat à signer (PDF)
                  </Button>
                ) : null}
                {/* La liste ne fait que montrer ; corriger se passe sur
                    l'écran dédié, copie par copie. */}
                <Link
                  href={`/modules/${moduleId}/controle/correction?groupe=${groupeId}&controle=${controleId}&copie=${selected.id}`}
                  className={buttonStyles("primary", "sm")}
                >
                  <PenLine size={16} aria-hidden />
                  Corriger cette copie
                </Link>
              </div>

              <p className="mt-4 font-display text-4xl font-bold text-ink">
                {Number(selected.note) || 0}{" "}
                <span className="text-lg text-slate">/ {totalAttendu}</span>
              </p>

              <div className="mt-5 space-y-4">
                {(selected.responses ?? []).map((d, i) => (
                  <div
                    key={d.question_id}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-sm font-bold text-ink">
                        Question {i + 1}
                      </h3>
                      <Badge
                        tone={
                          d.points === null
                            ? "neutral"
                            : d.points === d.bareme
                              ? "success"
                              : d.points > 0
                                ? "info"
                                : "danger"
                        }
                      >
                        {d.points ?? "—"} / {d.bareme} pts
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink">{d.enonce}</p>
                    <p className="mt-2 text-sm text-slate">
                      <span className="font-medium text-ink">
                        Réponse du stagiaire :
                      </span>{" "}
                      {d.reponse || "(vide)"}
                    </p>
                    {d.commentaire ? (
                      <p className="mt-2 text-sm text-ink">
                        <span className="font-medium">Commentaire :</span>{" "}
                        {d.commentaire}
                      </p>
                    ) : null}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-ink">
                        Voir le corrigé
                      </summary>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate">
                        {d.corrige}
                      </p>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        </>
      )}

    </div>
  );
}
