"use client";

import { useEffect, useRef } from "react";

/**
 * Les feux d'artifice de la distinction (PRD §4.5).
 *
 * Dessinés sur un canvas plutôt qu'assemblés en éléments animés : deux cents
 * particules en DOM feraient ramer le téléphone qu'on veut justement faire
 * sourire. Ils s'arrêtent d'eux-mêmes, et ne démarrent pas du tout si le
 * système demande à réduire les animations.
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
}: {
  actif: boolean;
  hauteurGerbe?: number;
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
      // Trois gerbes, espacées : une salve continue tiendrait de l'écran de
      // veille, pas de la félicitation.
      if (image === 1 || image === 28 || image === 58) {
        gerbe(largeur * (0.25 + Math.random() * 0.5), hauteur * hauteurGerbe);
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
  }, [actif, hauteurGerbe]);

  return (
    <canvas
      ref={toile}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
