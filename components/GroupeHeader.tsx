"use client";

import { usePathname } from "next/navigation";
import { useToast } from "./ui/Toast";
import Breadcrumb from "./Breadcrumb";
import { Link as LinkIcon } from "lucide-react";
import type { Groupe } from "@/app/actions/groupes";
import Button from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { ONGLETS_GROUPE, ongletGroupeActif } from "@/lib/navigation";

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
  const onglet = ongletGroupeActif(pathname);
  if (onglet.key !== ONGLETS_GROUPE[0].key) items.push({ label: onglet.label });

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
        <Button variant="secondary" size="sm" icon={LinkIcon} onClick={copyPublicLink}>
          Copier le lien public
        </Button>
      </div>
      <p className="mt-1 text-sm text-slate">
        {formatDate(groupe.date_debut)} → {formatDate(groupe.date_fin)}
      </p>
    </div>
  );
}
