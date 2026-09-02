"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Button from "./Button";

/**
 * Modale du système visuel v3 : coins 14 px, ombre flottante (le panneau se
 * détache du fond, il n'est pas posé dessus). Ferme sur Échap et sur clic hors panneau,
 * verrouille le défilement du fond, et place le focus à l'ouverture.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const panneauRef = useRef<HTMLDivElement>(null);

  // `onClose` est presque toujours une fonction fléchée écrite dans le JSX :
  // elle change d'identité à chaque rendu. La garder dans les dépendances
  // relançait l'effet à chaque frappe — et le `focus()` sur le panneau
  // arrachait le curseur du champ en cours de saisie. Une référence tient la
  // version courante sans peser sur les dépendances.
  const fermerRef = useRef(onClose);
  useEffect(() => {
    fermerRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fermerRef.current();
    }
    document.addEventListener("keydown", onKey);

    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Une seule fois, à l'ouverture : le panneau prend le focus pour que la
    // tabulation et Échap partent de la modale, pas de la page derrière.
    panneauRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrecedent;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fermerRef.current();
      }}
    >
      <div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[14px] border border-border bg-surface p-6 shadow-flottant focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-[22px] font-semibold leading-tight text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1 text-slate transition-colors duration-150 ease-out hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)]"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {description ? (
          <div className="mt-2 text-[15px] leading-relaxed text-slate-2">
            {description}
          </div>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        {footer ? (
          <div className="mt-6 flex justify-end gap-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation avant action destructive.
 * Le design system interdit la suppression en un clic.
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Supprimer",
  cancelLabel = "Annuler",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            loading={busy}
            loadingLabel="…"
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
