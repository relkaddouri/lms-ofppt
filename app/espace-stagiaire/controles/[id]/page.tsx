import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import {
  getMesControles,
  getSujet,
  getMaCopie,
} from "@/app/actions/controles-stagiaire";
import { testOuvert } from "@/lib/controles";
import Passation from "./Passation";
import MaCopieVue from "./MaCopieVue";

export default async function ControlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const controles = await getMesControles();
  const controle = controles.find((c) => c.id === id);
  if (!controle) notFound();

  // Une copie rendue ne se recompose pas : on affiche le résultat.
  if (controle.passationId) {
    const copie = await getMaCopie(id);
    return <MaCopieVue controle={controle} copie={copie} />;
  }

  // Un test fermé sans copie : le dire, plutôt qu'un sujet vide (PRD §4.7bis).
  if (!testOuvert(controle)) {
    return (
      <div className="flex flex-col gap-5">
        <Link
          href="/espace-stagiaire/controles"
          className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm text-slate hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Contrôles
        </Link>
        <section className="flex flex-col items-start gap-3 rounded-[14px] border border-border bg-surface px-5 py-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-wash-strong text-slate-2">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="font-display text-[20px] font-semibold text-ink">
            {controle.titre ?? "Contrôle de test"}
          </h1>
          <p className="text-[15px] leading-relaxed text-body">
            Ce test est fermé : il ne se compose plus. Il s&apos;ouvre quand
            votre formateur le décide — revenez à ce moment-là.
          </p>
        </section>
      </div>
    );
  }

  const sujet = await getSujet(id);
  return <Passation controle={controle} sujet={sujet} />;
}
