"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleCheck } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { marquerChapitreLu } from "@/app/actions/cours-stagiaire";

/**
 * « J'ai terminé ce chapitre » (PRD §4.5bis).
 *
 * La progression appartient au stagiaire : il la pose et la retire lui-même,
 * et le formateur ne la voit pas. Le bouton dit donc ce qu'il fait — terminer,
 * ou revenir en arrière —, sans félicitation ni score.
 */
export default function MarquerLu({
  supportId,
  lu,
}: {
  supportId: string;
  lu: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, demarrer] = useTransition();
  const [etat, setEtat] = useState(lu);

  function basculer() {
    const cible = !etat;
    demarrer(async () => {
      try {
        await marquerChapitreLu(supportId, cible);
        setEtat(cible);
        toast(cible ? "Chapitre terminé." : "Chapitre remis à lire.");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
      }
    });
  }

  return (
    <Button
      variant={etat ? "secondary" : "primary"}
      icon={etat ? CircleCheck : Check}
      onClick={basculer}
      loading={enCours}
      className="min-h-[44px]"
    >
      {etat ? "Chapitre terminé" : "J'ai terminé ce chapitre"}
    </Button>
  );
}
