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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 md:px-10 md:pb-14">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
          Configuration
        </span>
        <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Paramètres
        </h1>
      </header>

      <ParametresOnglets llm={llm} heures={heures} />
    </div>
  );
}
