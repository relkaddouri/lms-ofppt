"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import {
  getDistinctionAFeter,
  marquerDistinctionVue,
  type DistinctionAFeter,
} from "@/app/actions/distinction";
import { Crown } from "lucide-react";

/**
 * La fête du stagiaire de la journée (PRD §4.5).
 *
 * Elle s'ouvre à l'arrivée dans l'application, pour tout le groupe : chacun
 * apprend qui a été distingué, et le félicite ensuite dans le fil. Une fois
 * fermée, elle ne revient pas — la table `distinctions_vues` le retient, sans
 * quoi une célébration deviendrait une gêne au troisième affichage.
 *
 * Les feux d'artifice sont dessinés sur un canvas plutôt qu'assemblés en
 * éléments animés : deux cents particules en DOM feraient ramer le téléphone
 * qu'on veut justement faire sourire. Ils s'arrêtent d'eux-mêmes, et ne
 * démarrent pas du tout si le système demande à réduire les animations.
 */

type Particule = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  teinte: string;
};

/** Les trois accents de la charte, et rien d'autre. */
const TEINTES = ["#3C8C5C", "#2E7D9E", "#E2574C", "#F4C542"];

function Feux({ actif }: { actif: boolean }) {
  const toile = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!actif) return;
    const reduit = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reduit) return;

    const canvas = toile.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const largeur = canvas.clientWidth;
    const hauteur = canvas.clientHeight;
    canvas.width = largeur * dpr;
    canvas.height = hauteur * dpr;
    ctx.scale(dpr, dpr);

    const particules: Particule[] = [];
    const gerbe = (cx: number, cy: number) => {
      const teinte = TEINTES[Math.floor(Math.random() * TEINTES.length)]!;
      for (let i = 0; i < 36; i++) {
        const angle = (Math.PI * 2 * i) / 36 + Math.random() * 0.2;
        const vitesse = 1.6 + Math.random() * 2.2;
        particules.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * vitesse,
          vy: Math.sin(angle) * vitesse,
          vie: 1,
          teinte,
        });
      }
    };

    let image = 0;
    let animation = 0;
    const dessiner = () => {
      image++;
      // Trois gerbes, espacées : une salve continue tiendrait de l'écran de
      // veille, pas de la félicitation.
      if (image === 1 || image === 28 || image === 58) {
        gerbe(largeur * (0.25 + Math.random() * 0.5), hauteur * 0.38);
      }
      ctx.clearRect(0, 0, largeur, hauteur);
      for (const p of particules) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045;
        p.vie -= 0.011;
        if (p.vie <= 0) continue;
        ctx.globalAlpha = Math.max(p.vie, 0);
        ctx.fillStyle = p.teinte;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (particules.some((p) => p.vie > 0)) {
        animation = requestAnimationFrame(dessiner);
      }
    };
    animation = requestAnimationFrame(dessiner);
    return () => cancelAnimationFrame(animation);
  }, [actif]);

  return (
    <canvas
      ref={toile}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

export default function ModaleDistinction() {
  const [fete, setFete] = useState<DistinctionAFeter | null>(null);

  useEffect(() => {
    let annule = false;
    getDistinctionAFeter()
      .then((d) => {
        if (!annule) setFete(d);
      })
      // Silencieux : rater une fête n'est pas une erreur à signaler au
      // stagiaire, qui n'y peut rien et n'attendait rien.
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, []);

  if (!fete) return null;

  const nom = `${fete.prenom} ${fete.nom}`.trim();

  async function fermer() {
    const id = fete?.id;
    setFete(null);
    if (id) await marquerDistinctionVue(id).catch(() => {});
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stagiaire de la journée"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-5 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[20px] border border-border bg-surface px-6 py-8 text-center shadow-repos">
        <Feux actif />

        <div className="relative flex flex-col items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-wash text-green-dark">
            <Crown size={22} aria-hidden />
          </span>

          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-light">
            Stagiaire de la journée
          </p>

          <span className="relative">
            <Avatar
              nom={fete.nom}
              prenom={fete.prenom}
              photo={fete.photo}
              taille="lg"
              className="h-[88px] w-[88px] text-[30px]"
            />
            <span
              aria-hidden
              className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-[#F4C542] text-ink"
            >
              <Crown size={15} aria-hidden />
            </span>
          </span>

          <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
            {fete.cestMoi ? `Bravo ${fete.prenom} !` : `Bravo à ${nom} !`}
          </h2>

          <p className="text-[15px] leading-relaxed text-body">
            {fete.cestMoi
              ? "Tu es distingué pour ta participation d'aujourd'hui."
              : `${fete.prenom} est distingué pour sa participation d'aujourd'hui.`}
          </p>

          {/* La série ne s'annonce qu'à partir du deuxième jour : « 1 jour
              d'affilée » ne veut rien dire. */}
          {fete.serie > 1 ? (
            <p className="rounded-full bg-tint-teal px-3.5 py-1.5 text-[13.5px] font-semibold text-teal-dark">
              {fete.serie} jours d&apos;affilée — impressionnant.
            </p>
          ) : null}

          <Button onClick={fermer} className="mt-1 w-full justify-center">
            {fete.cestMoi ? "Merci !" : "Le féliciter"}
          </Button>

          <p className="text-[12.5px] text-slate-light">
            Une annonce vous attend dans le fil pour le féliciter.
          </p>
        </div>
      </div>
    </div>
  );
}
