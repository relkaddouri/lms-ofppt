import { notFound } from "next/navigation";
import {
  getMesControles,
  getSujet,
  getMaCopie,
} from "@/app/actions/controles-stagiaire";
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

  const sujet = await getSujet(id);
  return <Passation controle={controle} sujet={sujet} />;
}
