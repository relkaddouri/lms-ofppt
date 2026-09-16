"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import {
  getContenuVersion,
  getVersionsControle,
  type ContenuVersion,
  type VersionControle,
} from "@/app/actions/controles";

function origine(v: VersionControle): string {
  if (v.origine === "restauration") {
    return v.source_numero
      ? `Retour à la version ${v.source_numero}`
      : "Retour à une version antérieure";
  }
  if (v.origine === "duplication") {
    return v.source_numero
      ? `Variante créée depuis la version ${v.source_numero} de l'original`
      : "Variante d'un autre contrôle";
  }
  return "Enregistrement";
}

const pts = (n: number) =>
  `${String(n).replace(".", ",")} pt${n > 1 ? "s" : ""}`;

/**
 * Les versions d'un contrôle (PRD §4.7bis).
 *
 * Revenir à une version ne réécrit rien : elle est rechargée dans l'éditeur,
 * où le formateur la relit, et c'est en l'enregistrant qu'elle devient la
 * version courante — sous un nouveau numéro. Aucune version n'est jamais
 * effacée, pas même celle qu'on quitte.
 */
export default function VersionsControle({
  open,
  onClose,
  controleId,
  modifie,
  onRestaurer,
}: {
  open: boolean;
  onClose: () => void;
  controleId: string | null;
  /** L'éditeur a des modifications non enregistrées, que recharger perdrait. */
  modifie: boolean;
  onRestaurer: (contenu: ContenuVersion, numero: number) => void;
}) {
  const toast = useToast();
  const [versions, setVersions] = useState<VersionControle[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !controleId) return;
    let annule = false;
    setVersions(null);
    getVersionsControle(controleId)
      .then((v) => !annule && setVersions(v))
      .catch((err) => {
        if (annule) return;
        setVersions([]);
        toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, controleId]);

  async function revenir(v: VersionControle) {
    setEnCours(v.id);
    try {
      const contenu = await getContenuVersion(v.id);
      if (!contenu) throw new Error("Version introuvable.");
      onRestaurer(contenu, v.numero);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Versions du contrôle"
      description={
        modifie
          ? "Vous avez des modifications non enregistrées : revenir à une version les remplace dans l'éditeur."
          : "Chaque enregistrement conserve une version. Revenir à l'une d'elles la recharge dans l'éditeur ; elle devient la version courante quand vous l'enregistrez."
      }
    >
      {versions === null ? (
        <p className="py-4 text-sm text-slate">Chargement…</p>
      ) : versions.length === 0 ? (
        <p className="py-4 text-sm text-slate">
          Aucune version : le contrôle n&apos;a pas encore été enregistré.
        </p>
      ) : (
        <ol className="flex max-h-[60vh] flex-col divide-y divide-separator overflow-y-auto">
          {versions.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-8 min-w-8 items-center justify-center rounded-[8px] bg-wash px-2 font-mono text-[13px] font-semibold text-ink">
                v{v.numero}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14.5px] text-body">{origine(v)}</span>
                <span className="font-mono text-[12px] text-slate-light">
                  {formatDateTime(v.created_at)} · {v.nb_questions} question
                  {v.nb_questions > 1 ? "s" : ""} · {pts(v.total_bareme)}
                </span>
              </span>
              {i === 0 ? (
                <span className="rounded-full border border-tint-green bg-success-wash px-2.5 py-[3px] text-[12.5px] font-semibold text-green-dark">
                  Enregistrée en dernier
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={RotateCcw}
                  onClick={() => revenir(v)}
                  loading={enCours === v.id}
                  disabled={enCours !== null}
                >
                  Revenir à cette version
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
