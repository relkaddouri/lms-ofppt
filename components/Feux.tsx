"use client";

import { useEffect, useRef } from "react";

/**
 * Les feux d'artifice de la distinction (PRD §4.5).
 *
 * Dessinés sur un canvas plutôt qu'assemblés en éléments animés : deux cents
 * particules en DOM feraient ramer le téléphone qu'on veut justement faire
 * sourire. Ils s'arrêtent d'eux-mêmes — sauf en mode `continu` —, et ne
 * démarrent pas du tout si le système demande à réduire les animations.
 *
 * Partagés entre la modale et le fil : la fête doit être la même où qu'on la
 * rencontre, et deux implémentations auraient divergé au premier réglage.
 */

type Particule = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  teinte: string;
};

/** Les trois accents de la charte, et l'or de la couronne. */
const TEINTES = ["#3C8C5C", "#2E7D9E", "#E2574C", "#F4C542"];

export default function Feux({
  actif,
  /**
   * D'où partent les gerbes, en fraction de la hauteur.
   *
   * La modale est haute et centrée : 0,38 place la gerbe au-dessus du visage.
   * Une carte de fil est basse et large, et la même valeur ferait éclater les
   * particules dans le texte.
   */
  hauteurGerbe = 0.38,
  /**
   * La fête ne s'éteint pas.
   *
   * Pour le podium d'un classement, qu'on relit plus tard dans le fil : trois
   * gerbes jouées une fois ne diraient plus rien à celui qui arrive après. Le
   * rythme est alors plus lent — une gerbe toutes les secondes et demie —
   * pour tenir de la guirlande et non du gyrophare, et l'animation s'arrête
   * dès que le podium sort de l'écran : personne ne doit payer en batterie
   * une fête qu'il ne regarde pas.
   */
  continu = false,
}: {
  actif: boolean;
  hauteurGerbe?: number;
  continu?: boolean;
}) {
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
    if (largeur === 0 || hauteur === 0) return;
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
      // Trois gerbes espacées puis le silence ; en continu, une gerbe toutes
      // les quatre-vingt-dix images — une salve nourrie tiendrait de l'écran
      // de veille, pas de la félicitation.
      const tire = continu
        ? image === 1 || image % 70 === 0
        : image === 1 || image === 28 || image === 58;
      if (tire) {
        gerbe(largeur * (0.2 + Math.random() * 0.6), hauteur * hauteurGerbe);
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
        // Un peu plus gros en continu : la gerbe est seule à l'écran, et des
        // points de deux pixels sur un fond pâle passeraient pour une
        // poussière d'affichage.
        ctx.arc(p.x, p.y, continu ? 3 : 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Les particules éteintes sortent du tableau : en continu, les garder
      // ferait grossir la liste sans fin.
      if (continu) {
        for (let i = particules.length - 1; i >= 0; i--) {
          if (particules[i]!.vie <= 0) particules.splice(i, 1);
        }
      }
      if (continu || particules.some((p) => p.vie > 0)) {
        animation = requestAnimationFrame(dessiner);
      } else {
        animation = 0;
      }
    };

    // Hors de l'écran, on ne dessine pas : un canvas qui tourne au bas d'un
    // fil qu'on ne regarde plus coûte de la batterie pour rien.
    const relancer = () => {
      if (!animation) animation = requestAnimationFrame(dessiner);
    };
    const suspendre = () => {
      if (animation) cancelAnimationFrame(animation);
      animation = 0;
    };

    const observateur = continu
      ? new IntersectionObserver(
          ([entree]) => (entree?.isIntersecting ? relancer() : suspendre()),
          { threshold: 0 },
        )
      : null;
    if (observateur) observateur.observe(canvas);
    else relancer();

    return () => {
      observateur?.disconnect();
      suspendre();
    };
  }, [actif, hauteurGerbe, continu]);

  return (
    <canvas
      ref={toile}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
