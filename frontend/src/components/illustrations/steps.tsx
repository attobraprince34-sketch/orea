/**
 * Illustrations vectorielles originales des 3 étapes « Comment ça marche ».
 * Palette de la charte uniquement ; traits Encre de 4 px comme les cartes « stickers ».
 */

const INK = "currentColor";
const EMERALD = "#0F5C47";
const ORANGE = "#F08A24";
const MINT = "#EAF3EF";
const MINT_DARK = "#B5E8D4";

/** Étape 1 : un téléphone photographie une pièce. */
export function SnapIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" className={className} aria-hidden>
      <circle cx="190" cy="40" r="26" fill={ORANGE} opacity="0.18" />
      {/* Pièce */}
      <g transform="rotate(-8 80 110)">
        <rect x="22" y="78" width="118" height="72" rx="12" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
        <rect x="34" y="92" width="30" height="38" rx="6" fill={MINT_DARK} />
        <rect x="72" y="96" width="54" height="7" rx="3.5" fill={INK} opacity="0.7" />
        <rect x="72" y="110" width="40" height="7" rx="3.5" fill={INK} opacity="0.35" />
        <rect x="72" y="124" width="48" height="7" rx="3.5" fill={INK} opacity="0.35" />
      </g>
      {/* Téléphone */}
      <g transform="rotate(10 170 90)">
        <rect x="132" y="22" width="78" height="138" rx="16" fill={EMERALD} stroke={INK} strokeWidth="4" />
        <rect x="140" y="36" width="62" height="100" rx="9" fill={MINT} />
        <path d="M150 52 h12 M150 52 v12 M192 52 h-12 M192 52 v12 M150 120 h12 M150 120 v-12 M192 120 h-12 M192 120 v-12" stroke={ORANGE} strokeWidth="4" strokeLinecap="round" />
        <circle cx="171" cy="148" r="6" fill={MINT} />
      </g>
      {/* Flash */}
      <path d="M214 18 l6 -10 M224 30 l11 -4 M206 10 l0 -9" stroke={ORANGE} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Étape 2 : deux épingles reliées, Orea fait le lien. */
export function MatchIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" className={className} aria-hidden>
      <path d="M62 90 C100 20 140 20 178 90" fill="none" stroke={ORANGE} strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
      {[{ x: 62, c: EMERALD }, { x: 178, c: EMERALD }].map(({ x, c }) => (
        <g key={x} transform={`translate(${x - 28} 70) scale(0.4)`}>
          <path d="M70 0C108.66 0 140 31.34 140 70C140 104.5 109.6 134 79.6 170.6C74.6 176.7 65.4 176.7 60.4 170.6C30.4 134 0 104.5 0 70C0 31.34 31.34 0 70 0Z" fill={c} stroke={INK} strokeWidth="10" />
          <circle cx="70" cy="70" r="34" fill="#FFFFFF" />
          <circle cx="70" cy="70" r="16" fill={ORANGE} />
        </g>
      ))}
      {/* Badge de correspondance */}
      <g transform="translate(92 22)">
        <rect width="56" height="30" rx="15" fill={ORANGE} stroke={INK} strokeWidth="4" />
        <path d="M17 15 l7 7 l14 -14" fill="none" stroke="#0E1A16" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <ellipse cx="62" cy="152" rx="22" ry="5" fill={INK} opacity="0.12" />
      <ellipse cx="178" cy="152" rx="22" ry="5" fill={INK} opacity="0.12" />
    </svg>
  );
}

/** Étape 3 : un billet QR et la boutique du point relais. */
export function PickupIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" className={className} aria-hidden>
      {/* Boutique */}
      <rect x="120" y="58" width="100" height="92" rx="8" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
      <path d="M112 62 L128 30 H212 L228 62 Z" fill={EMERALD} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M140 30 L134 62 M156 30 L154 62 M172 30 V62 M188 30 L190 62 M204 30 L210 62" stroke={MINT} strokeWidth="3" />
      <rect x="140" y="92" width="30" height="58" rx="4" fill={MINT_DARK} stroke={INK} strokeWidth="4" />
      <rect x="180" y="82" width="28" height="24" rx="4" fill={MINT} stroke={INK} strokeWidth="4" />
      {/* Billet QR */}
      <g transform="rotate(-10 70 96)">
        <rect x="22" y="44" width="92" height="110" rx="12" fill={ORANGE} stroke={INK} strokeWidth="4" />
        <rect x="36" y="58" width="64" height="64" rx="6" fill="#FFFFFF" stroke={INK} strokeWidth="3" />
        {[0, 1, 2, 3, 4, 5].flatMap((row) =>
          [0, 1, 2, 3, 4, 5].map((col) =>
            (row * 7 + col * 3) % 4 !== 0 ? (
              <rect key={`${row}-${col}`} x={42 + col * 9} y={64 + row * 9} width="7" height="7" fill="#0E1A16" />
            ) : null,
          ),
        )}
        <rect x="40" y="132" width="56" height="7" rx="3.5" fill="#0E1A16" opacity="0.7" />
      </g>
    </svg>
  );
}

/** Bouclier de la section sécurité. */
export function ShieldIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" className={className} aria-hidden>
      <circle cx="100" cy="110" r="96" fill={ORANGE} opacity="0.12" />
      <path d="M100 18 L170 44 V104 C170 150 140 182 100 200 C60 182 30 150 30 104 V44 Z" fill={EMERALD} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M100 38 L152 58 V104 C152 138 131 162 100 178 Z" fill="#FFFFFF" opacity="0.12" />
      <rect x="70" y="96" width="60" height="50" rx="10" fill="#FFFFFF" stroke={INK} strokeWidth="5" />
      <path d="M82 96 V82 a18 18 0 0 1 36 0 V96" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
      <path d="M82 96 V82 a18 18 0 0 1 36 0 V96" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <circle cx="100" cy="118" r="8" fill={ORANGE} />
      <rect x="97" y="122" width="6" height="12" rx="3" fill={ORANGE} />
    </svg>
  );
}
