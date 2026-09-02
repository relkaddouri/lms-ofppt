import { getCalendrier } from "@/app/actions/calendrier";
import { getBilanHeures } from "@/app/actions/heures";
import { getEcheances } from "@/app/actions/echeances";
import {
  getIndisponibilites,
  getIndisponibilitesAVenir,
} from "@/app/actions/indisponibilites";
import CalendrierSemaine from "./CalendrierSemaine";
import { dateLocale } from "@/lib/format";

/** Lundi de la semaine contenant la date donnée. */
function lundiDe(d: Date): Date {
  const j = new Date(d);
  const decalage = (j.getDay() + 6) % 7;
  j.setDate(j.getDate() - decalage);
  j.setHours(0, 0, 0, 0);
  return j;
}

const iso = dateLocale;

export const metadata = { title: "Calendrier" };

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const { semaine } = await searchParams;

  const reference = semaine ? new Date(`${semaine}T12:00:00`) : new Date();
  const lundi = lundiDe(Number.isNaN(reference.getTime()) ? new Date() : reference);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);

  const [calendrier, bilan, echeances, indisponibilites, aVenir] =
    await Promise.all([
      getCalendrier(iso(lundi), iso(dimanche)),
      getBilanHeures(),
      getEcheances(),
      // Celles de la semaine grisent la grille ; celles à venir peuplent le
      // panneau, pour rester modifiables depuis n'importe quelle semaine.
      getIndisponibilites(iso(lundi), iso(dimanche)),
      getIndisponibilitesAVenir(iso(lundi)),
    ]);

  return (
    <CalendrierSemaine
      lundi={iso(lundi)}
      seances={calendrier.seances}
      controles={calendrier.controles}
      aPlanifier={calendrier.aPlanifier}
      seancesSansDate={calendrier.seancesSansDate}
      bilan={bilan}
      echeances={echeances}
      indisponibilites={indisponibilites}
      indisponibilitesAVenir={aVenir}
    />
  );
}
