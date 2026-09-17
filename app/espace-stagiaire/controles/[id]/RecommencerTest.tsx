"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { recommencerCopieDeTest } from "@/app/actions/controles-stagiaire";

/** Le compte de test efface sa copie pour repasser le contrôle (migration 093). */
export default function RecommencerTest({ controleId }: { controleId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, setEnCours] = useState(false);

  return (
    <Button
      variant="secondary"
      icon={RotateCcw}
      loading={enCours}
      onClick={async () => {
        setEnCours(true);
        try {
          await recommencerCopieDeTest(controleId);
          // Le chronomètre repart à zéro avec la nouvelle tentative.
          try {
            localStorage.removeItem(`pedago:debut-test:${controleId}`);
            localStorage.removeItem(`pedago:copie:${controleId}`);
          } catch {
            // Rien à nettoyer.
          }
          toast("Copie de test effacée : vous pouvez repasser le contrôle.");
          router.refresh();
        } catch (e) {
          toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
        } finally {
          setEnCours(false);
        }
      }}
    >
      Effacer ma copie de test et recommencer
    </Button>
  );
}
