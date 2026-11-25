/**
 * Confettis aux couleurs de la charte, pour les grands moments :
 * correspondance trouvée, QR code obtenu, pièce restituée.
 * Respecte « réduire les animations » : rien ne s'affiche dans ce cas.
 */

import confetti from "canvas-confetti";

const BRAND_COLORS = ["#0F5C47", "#F08A24", "#EAF3EF", "#8CD2B8", "#FFA151"];

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function celebrate() {
  if (reducedMotion()) return;
  const base = { colors: BRAND_COLORS, disableForReducedMotion: true, zIndex: 9999 };
  confetti({ ...base, particleCount: 90, spread: 70, origin: { y: 0.65 } });
  setTimeout(() => confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }), 180);
  setTimeout(() => confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }), 320);
}
