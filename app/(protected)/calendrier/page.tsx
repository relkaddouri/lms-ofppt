import { getCalendrier } from "@/app/actions/calendrier";
import CalendrierSemaine from "./CalendrierSemaine";

/** Lundi de la semaine contenant la date donnée. */
function lundiDe(d: Date): Date {
  const j = new Date(d);
  const decalage = (j.getDay() + 6) % 7;
  j.setDate(j.getDate() - decalage);
  j.setHours(0, 0, 0, 0);
  return j;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

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

  const calendrier = await getCalendrier(iso(lundi), iso(dimanche));

  return (
    <CalendrierSemaine
      lundi={iso(lundi)}
      seances={calendrier.seances}
      controles={calendrier.controles}
    />
  );
}
