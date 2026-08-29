import { Sparkles } from "lucide-react";

/**
 * Marque un contenu sorti du modèle et pas encore repassé par le formateur.
 *
 * `design_system.md` en fait la leçon directe de l'audit précédent : ne jamais
 * laisser un contenu généré passer pour définitif sans passage humain visible.
 * Le bandeau disparaît à la première modification ou à l'enregistrement — à ce
 * moment le formateur a relu, et le contenu redevient un contenu comme un autre.
 *
 * Volontairement discret : il informe, il n'alerte pas. Un contenu généré n'est
 * pas une erreur, c'est un brouillon.
 */
export default function BandeauIa({ children }: { children?: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mb-4 flex items-center gap-2 rounded-lg border border-forest/30 bg-mint px-3 py-2 text-xs text-forest"
    >
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        {children ?? "Généré par l'IA — à relire avant de vous en servir."}
      </span>
    </p>
  );
}
