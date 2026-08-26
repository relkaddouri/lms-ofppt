"use client";

import ErreurEcran from "@/components/ui/ErreurEcran";

export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErreurEcran error={error} reset={reset} />;
}
