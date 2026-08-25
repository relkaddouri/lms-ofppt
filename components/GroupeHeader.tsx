"use client";

import { usePathname } from "next/navigation";
import { useToast } from "./Toast";
import Breadcrumb from "./Breadcrumb";
import { Link as LinkIcon } from "lucide-react";
import type { Groupe } from "@/app/actions/groupes";

const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper focus:outline-none focus:ring-2 focus:ring-forest";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function GroupeHeader({
  groupe,
  stagiairesCount,
}: {
  groupe: Groupe;
  stagiairesCount: number;
}) {
  const toast = useToast();
  const pathname = usePathname();

  async function copyPublicLink() {
    if (!groupe.token_public) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/public/groupe/${groupe.token_public}`,
      );
      toast("Lien public copié");
    } catch {
      toast("Copie impossible", "error");
    }
  }

  const items: { label: string; href?: string }[] = [
    { label: "Groupes", href: "/groupes" },
    { label: groupe.nom, href: `/groupes/${groupe.id}` },
  ];
  if (pathname.endsWith("/progression")) items.push({ label: "Progression" });
  else if (pathname.endsWith("/annonces")) items.push({ label: "Annonces" });
  else if (pathname.endsWith("/fiches")) items.push({ label: "Fiches" });
  else if (pathname.endsWith("/controles")) items.push({ label: "Contrôles" });

  return (
    <div>
      <Breadcrumb items={items} />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[24px] font-bold text-ink">
          {groupe.nom}
        </h1>
        <span className="rounded-full border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-3 py-1 text-xs font-medium text-slate">
          {stagiairesCount} stagiaire{stagiairesCount > 1 ? "s" : ""}
        </span>
        <button onClick={copyPublicLink} className={btnSecondary}>
          <LinkIcon size={16} />
          Copier le lien public
        </button>
      </div>
      <p className="mt-1 text-sm text-slate">
        {formatDate(groupe.date_debut)} → {formatDate(groupe.date_fin)}
      </p>
    </div>
  );
}
