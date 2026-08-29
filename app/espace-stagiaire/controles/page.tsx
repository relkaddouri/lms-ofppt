import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getMesControles } from "@/app/actions/controles-stagiaire";
import { formatDate } from "@/lib/format";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Contrôles" };

export default async function ControlesPage() {
  const controles = await getMesControles();

  if (controles.length === 0) {
    return (
      <EnConstruction
        titre="Aucun contrôle"
        description="Les contrôles de votre groupe apparaîtront ici dès que votre formateur les aura validés."
        Icone={FileCheck2}
      />
    );
  }

  const aPasser = controles.filter((c) => c.passationId === null);
  const rendus = controles.filter((c) => c.passationId !== null);

  const carte = (c: (typeof controles)[number]) => (
    <Link
      key={c.id}
      href={`/espace-stagiaire/controles/${c.id}`}
      className="block border-b border-border p-4 last:border-0 hover:bg-mint"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">
            {c.titre ?? c.moduleNom ?? "Contrôle"}
          </h2>
          <p className="mt-0.5 text-xs text-slate">
            {[
              c.codeOperationnel,
              c.type === "EFM"
                ? c.type_efm === "regional"
                  ? "EFM régional"
                  : "EFM local"
                : "Contrôle continu",
              c.duree_heures ? `${c.duree_heures} h` : null,
              c.date_prevue ? formatDate(c.date_prevue) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {c.note !== null ? (
          <Badge tone={c.note >= 10 ? "success" : "danger"}>
            {c.note.toLocaleString("fr-FR")} / 20
          </Badge>
        ) : (
          <Badge tone="info">à composer</Badge>
        )}
      </div>
    </Link>
  );

  return (
    <div className="space-y-4">
      {aPasser.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          {aPasser.map(carte)}
        </section>
      ) : null}

      {rendus.length > 0 ? (
        <section>
          <h2 className="px-1 text-sm font-medium text-slate">
            Copies rendues ({rendus.length})
          </h2>
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
            {rendus.map(carte)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
