/**
 * Description des fournisseurs LLM proposés dans les paramètres.
 *
 * Ce fichier est importé côté navigateur : il ne contient que des métadonnées
 * publiques (URL, libellés, documentation). Aucune clé, aucun secret.
 */

export type Fournisseur = "anthropic" | "openai" | "deepseek" | "compatible";

export type DescriptionFournisseur = {
  id: Fournisseur;
  nom: string;
  /** Ce que le formateur doit préparer avant de configurer. */
  resume: string;
  /** Imposée par l'application, sauf pour « compatible » où elle est saisie. */
  baseUrl: string | null;
  /** Où obtenir une clé. */
  docCle: string;
  /** À quoi ressemble une clé valide, pour détecter un copier-coller raté. */
  prefixeCle: string | null;
  /** Modèles proposés d'emblée. La liste réelle est relue via « Tester ». */
  modeles: { id: string; libelle: string }[];
  /** Le fournisseur accepte-t-il un réglage de température ? */
  temperature: boolean;
  remarque?: string;
};

export const FOURNISSEURS: DescriptionFournisseur[] = [
  {
    id: "anthropic",
    nom: "Claude (Anthropic)",
    resume: "Clé API Anthropic, créée depuis la console Anthropic.",
    baseUrl: "https://api.anthropic.com",
    docCle: "https://console.anthropic.com/settings/keys",
    prefixeCle: "sk-ant-",
    modeles: [
      { id: "claude-opus-5", libelle: "Claude Opus 5 — le plus capable" },
      { id: "claude-sonnet-5", libelle: "Claude Sonnet 5 — équilibré" },
      { id: "claude-haiku-4-5", libelle: "Claude Haiku 4.5 — rapide et économique" },
    ],
    temperature: false,
    remarque:
      "Les modèles Claude récents refusent le réglage de température : le champ est ignoré pour ce fournisseur.",
  },
  {
    id: "openai",
    nom: "OpenAI (GPT)",
    resume: "Clé API OpenAI. Le modèle se choisit après le test de connexion.",
    baseUrl: "https://api.openai.com/v1",
    docCle: "https://platform.openai.com/api-keys",
    prefixeCle: "sk-",
    modeles: [],
    temperature: true,
    remarque:
      "La liste des modèles disponibles est relue depuis votre compte : enregistrez la clé puis cliquez sur « Tester la connexion ».",
  },
  {
    id: "deepseek",
    nom: "DeepSeek",
    resume: "Clé API DeepSeek.",
    baseUrl: "https://api.deepseek.com/v1",
    docCle: "https://platform.deepseek.com/api_keys",
    prefixeCle: "sk-",
    modeles: [
      { id: "deepseek-chat", libelle: "deepseek-chat — génération" },
      { id: "deepseek-reasoner", libelle: "deepseek-reasoner — raisonnement" },
    ],
    temperature: true,
  },
  {
    id: "compatible",
    nom: "Autre API compatible OpenAI",
    resume:
      "Tout service exposant /chat/completions au format OpenAI : Groq, Mistral, OpenRouter, Together, un modèle local (Ollama, LM Studio)…",
    baseUrl: null,
    docCle: "",
    prefixeCle: null,
    modeles: [],
    temperature: true,
    remarque:
      "Indiquez l'URL de base jusqu'à la version incluse, sans /chat/completions — par exemple https://openrouter.ai/api/v1 ou http://localhost:11434/v1.",
  },
];

export function fournisseur(id: string): DescriptionFournisseur | undefined {
  return FOURNISSEURS.find((f) => f.id === id);
}

/** URL effective : imposée par le fournisseur, ou saisie pour « compatible ». */
export function urlEffective(id: Fournisseur, saisie: string | null): string | null {
  const f = fournisseur(id);
  if (!f) return null;
  return f.baseUrl ?? (saisie?.trim() || null);
}
