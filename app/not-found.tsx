import Link from "next/link";
import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import { Compass, House } from "lucide-react";

export default function Introuvable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-8">
      <Card className="w-full max-w-md p-8 text-center" padded={false}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint">
          <Compass className="h-6 w-6 text-forest" aria-hidden />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-ink">
          Page introuvable
        </h1>
        <p className="mt-2 text-sm text-slate">
          Cette adresse ne correspond à aucune page. Elle a peut-être été
          supprimée, ou le lien est incomplet.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/dashboard" className={buttonStyles("primary")}>
            <House size={16} aria-hidden />
            Retour au tableau de bord
          </Link>
        </div>
      </Card>
    </div>
  );
}
