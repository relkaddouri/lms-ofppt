"use client";

import { useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { RefreshCw, TriangleAlert } from "lucide-react";

/**
 * Écran d'erreur commun aux frontières d'erreur du projet.
 *
 * conventions.md L.39 : une erreur technique brute n'est jamais montrée à
 * l'utilisateur. Le détail part dans la console serveur/navigateur, l'écran
 * n'affiche qu'un message clair et une action de reprise.
 */
export default function ErreurEcran({
  error,
  reset,
  titre = "Quelque chose s'est mal passé",
  message = "L'affichage de cette page a échoué. Réessayez dans un instant.",
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  titre?: string;
  message?: string;
}) {
  useEffect(() => {
    console.error("Frontière d'erreur :", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <Card className="w-full max-w-md p-8 text-center" padded={false}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
          <TriangleAlert className="h-6 w-6 text-danger" aria-hidden />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-ink">{titre}</h1>
        <p className="mt-2 text-sm text-slate">{message}</p>

        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-slate">
            Référence : {error.digest}
          </p>
        ) : null}

        {reset ? (
          <div className="mt-6 flex justify-center">
            <Button icon={RefreshCw} onClick={reset}>
              Réessayer
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
