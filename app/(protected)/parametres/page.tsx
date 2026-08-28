import { getParametresLlm } from "@/app/actions/parametres-llm";
import { getParametresFormateur } from "@/app/actions/heures";
import ParametresOnglets from "./ParametresOnglets";

export const metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  const [llm, heures] = await Promise.all([
    getParametresLlm(),
    getParametresFormateur(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Paramètres</h1>
      </header>

      <ParametresOnglets llm={llm} heures={heures} />
    </div>
  );
}
