import Link from "next/link";
import { BookOpen, MessageCircle } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getMesSupports } from "@/app/actions/questions-support";
import { formatDate } from "@/lib/format";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Cours" };

export default async function CoursPage() {
  const supports = await getMesSupports();

  if (supports.length === 0) {
    return (
      <EnConstruction
        titre="Aucun cours"
        description="Les supports de cours et les énoncés de TP remis par votre formateur apparaîtront ici."
        Icone={BookOpen}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {supports.map((s) => (
        <Link
          key={s.id}
          href={`/espace-stagiaire/cours/${s.id}`}
          className="flex min-h-[64px] items-start gap-3 border-b border-border p-4 last:border-0 hover:bg-mist"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint">
            <BookOpen className="h-4 w-4 text-forest" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug text-ink">
              {s.titre}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge
                tone={s.type === "pratique" ? "success" : "info"}
                variant="type"
              >
                {s.type === "pratique" ? "TP" : "cours"}
              </Badge>
              <p className="min-w-0 truncate text-xs text-slate">
                {[s.date ? formatDate(s.date) : null, s.moduleNom]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          {s.questions > 0 ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-slate">
              <MessageCircle className="h-4 w-4" aria-hidden />
              {s.questions}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
