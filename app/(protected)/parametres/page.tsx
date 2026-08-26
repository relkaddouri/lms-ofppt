import { getParametresLlm } from "@/app/actions/parametres-llm";
import ParametresLlmForm from "./ParametresLlmForm";

export const metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  const parametres = await getParametresLlm();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Paramètres</h1>
        <p className="mt-1 text-sm text-slate">
          Le modèle de langage utilisé pour générer les contrôles, les fiches de
          préparation et les corrigés.
        </p>
      </header>

      <div className="mt-6">
        <ParametresLlmForm initial={parametres} />
      </div>
    </div>
  );
}
