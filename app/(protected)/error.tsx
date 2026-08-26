"use client";

import ErreurEcran from "@/components/ui/ErreurEcran";

/**
 * Frontière d'erreur de l'espace formateur. Le message reste sous la barre
 * latérale et la barre supérieure, l'utilisateur ne perd pas sa navigation.
 */
export default function ErreurProtegee({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErreurEcran
      error={error}
      reset={reset}
      titre="Cette page n'a pas pu s'afficher"
      message="La récupération des données a échoué. Vérifiez votre connexion, puis réessayez."
    />
  );
}
