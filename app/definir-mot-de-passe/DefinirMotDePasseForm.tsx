"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";
import MarqueOfppt from "@/components/MarqueOfppt";
import ChampMotDePasse from "@/components/ui/ChampMotDePasse";

/**
 * Choix du mot de passe après invitation.
 *
 * Le formateur ne connaît jamais le mot de passe d'un stagiaire : il transmet
 * un lien, le stagiaire choisit lui-même.
 *
 * Les trois exigences et le barème de robustesse viennent de
 * `docs/new_design/Connexion.dc.html` : dix caractères, casse mixte, un
 * caractère spécial. La liste affichée est celle qui est réellement appliquée
 * — une case cochée qui n'empêche rien ne vaut rien.
 */
const NIVEAUX = [
  { label: "Trop court", couleur: "text-coral", barre: "bg-coral", largeur: "18%" },
  { label: "Faible", couleur: "text-coral", barre: "bg-coral", largeur: "40%" },
  { label: "Correct", couleur: "text-teal", barre: "bg-teal", largeur: "70%" },
  { label: "Robuste", couleur: "text-green", barre: "bg-green", largeur: "100%" },
] as const;

export default function DefinirMotDePasseForm({ email }: { email: string }) {
  const router = useRouter();
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const assezLong = motDePasse.length >= 10;
  const casseMixte = /[A-Z]/.test(motDePasse) && /[a-z]/.test(motDePasse);
  const caractereSpecial = /[^A-Za-z0-9]/.test(motDePasse);

  const regles = [
    { label: "10 caractères minimum", ok: assezLong },
    { label: "Majuscules et minuscules", ok: casseMixte },
    { label: "Au moins un caractère spécial", ok: caractereSpecial },
  ];

  const score =
    (assezLong ? 1 : 0) + (casseMixte ? 1 : 0) + (caractereSpecial ? 1 : 0);
  const niveau = NIVEAUX[score]!;

  const identiques = confirmation.length > 0 && confirmation === motDePasse;
  const pret = score === 3 && identiques;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!pret) return;

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
    <main className="flex min-h-dvh items-center justify-center bg-paper px-8 py-14">
      <div className="flex w-full max-w-[396px] flex-col gap-[26px]">
        <div className="flex flex-col items-center gap-3.5">
          <MarqueOfppt />
          <div className="flex flex-col items-center gap-[3px]">
            <span className="font-display text-[23px] font-bold tracking-[-0.01em] text-ink">
              LMS OFPPT
            </span>
            <span className="text-sm text-slate-light">
              Espace stagiaire · OFPPT
            </span>
          </div>
        </div>

        <form
          onSubmit={soumettre}
          className="flex flex-col gap-5 rounded-[14px] border border-border bg-surface px-7 py-[30px] shadow-detachee"
        >
          <div className="flex flex-col gap-[5px]">
            <h1 className="font-display text-[21px] font-semibold leading-tight text-ink">
              Définir votre mot de passe
            </h1>
            <span className="text-[14.5px] text-slate-light">
              Invitation reçue pour{" "}
              <span className="font-mono text-body">{email}</span>
            </span>
          </div>

          <label htmlFor="mdp" className="flex flex-col gap-[7px]">
            <span className="text-sm font-semibold text-body">
              Nouveau mot de passe
            </span>
            <ChampMotDePasse
              id="mdp"
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
            <span className="flex items-center gap-2">
              <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-wash">
                <span
                  className={`block h-full rounded-full transition-[width] duration-150 ease-out ${niveau.barre}`}
                  style={{ width: motDePasse ? niveau.largeur : "0%" }}
                />
              </span>
              {motDePasse ? (
                <span
                  className={`whitespace-nowrap text-[12.5px] font-semibold ${niveau.couleur}`}
                >
                  {niveau.label}
                </span>
              ) : null}
            </span>
          </label>

          <label htmlFor="confirmation" className="flex flex-col gap-[7px]">
            <span className="text-sm font-semibold text-body">
              Confirmer le mot de passe
            </span>
            <ChampMotDePasse
              id="confirmation"
              autoComplete="new-password"
              value={confirmation}
              bordure={
                confirmation.length === 0
                  ? "border-border-strong"
                  : identiques
                    ? "border-green"
                    : "border-coral"
              }
              onChange={(e) => setConfirmation(e.target.value)}
            />
            <span
              className={`text-[13px] ${
                confirmation.length === 0
                  ? "text-slate-light"
                  : identiques
                    ? "text-green-dark"
                    : "text-coral-dark"
              }`}
            >
              {confirmation.length === 0
                ? "Saisissez à nouveau le mot de passe."
                : identiques
                  ? "Les deux saisies correspondent."
                  : "Les deux saisies ne correspondent pas."}
            </span>
          </label>

          <ul className="flex flex-col gap-[7px] rounded-[10px] border border-separator bg-paper-alt p-3.5">
            {regles.map((r) => (
              <li key={r.label} className="flex items-center gap-[9px]">
                <span
                  className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full ${
                    r.ok ? "bg-green" : "bg-border-strong"
                  }`}
                >
                  {r.ok ? (
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.4} aria-hidden />
                  ) : null}
                </span>
                <span
                  className={`text-[13.5px] ${r.ok ? "text-green-dark" : "text-slate-light"}`}
                >
                  {r.label}
                </span>
              </li>
            ))}
          </ul>

          {erreur ? (
            <p
              role="alert"
              className="rounded-[10px] border border-tint-alert-strong bg-alert-wash px-4 py-3 text-sm text-coral-dark"
            >
              {erreur}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!pret || busy}
            className={`w-full rounded-[10px] border px-5 py-3.5 text-[15px] font-semibold text-white transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] ${
              pret && !busy
                ? "border-ink bg-ink hover:border-ofppt-ink-dark hover:bg-ofppt-ink-dark"
                : "cursor-not-allowed border-muted bg-muted"
            }`}
          >
            {busy ? "Enregistrement…" : "Activer mon compte"}
          </button>
        </form>

        <span className="text-center text-[13px] text-muted">
          Office de la Formation Professionnelle et de la Promotion du Travail
        </span>
      </div>
    </main>
  );
}
