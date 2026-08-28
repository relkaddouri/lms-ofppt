"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { inputStyles } from "@/components/ui/Input";
import { KeyRound } from "lucide-react";

/**
 * Choix du mot de passe après invitation.
 *
 * Le formateur ne connaît jamais le mot de passe d'un stagiaire : il transmet
 * un lien, le stagiaire choisit lui-même.
 */
export default function DefinirMotDePasseForm({ email }: { email: string }) {
  const router = useRouter();
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    if (motDePasse.length < 8) {
      setErreur("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux saisies ne correspondent pas.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    setBusy(false);

    if (error) {
      setErreur(error.message);
      return;
    }
    router.push("/espace-stagiaire/fil");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint">
          <KeyRound className="h-5 w-5 text-forest" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink">
          Définissez votre mot de passe
        </h1>
        <p className="mt-1 text-sm text-slate">
          Vous vous connecterez ensuite avec {email}.
        </p>

        <form onSubmit={soumettre} className="mt-5 space-y-4">
          <div>
            <label htmlFor="mdp" className="block text-sm font-medium text-ink">
              Mot de passe
            </label>
            <input
              id="mdp"
              type="password"
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className={`${inputStyles} mt-1`}
            />
            <p className="mt-1 text-xs text-slate">8 caractères au minimum.</p>
          </div>

          <div>
            <label
              htmlFor="confirmation"
              className="block text-sm font-medium text-ink"
            >
              Confirmation
            </label>
            <input
              id="confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className={`${inputStyles} mt-1`}
            />
          </div>

          {erreur ? <p className="text-sm text-danger">{erreur}</p> : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Enregistrement…" : "Valider"}
          </Button>
        </form>
      </div>
    </div>
  );
}
