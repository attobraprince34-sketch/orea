"use client";

/**
 * Ori, la mascotte d'Orea.
 *
 * C'est l'épingle du logo devenue personnage : l'anneau blanc et le point orange
 * forment un grand œil unique. On ajoute seulement de petits bras et des pieds
 * à l'Encre. Le logo officiel n'est pas modifié : Ori est une illustration à part.
 *
 * Humeurs : wave (accueil), search (recherche, chargement), scan (lecture OCR),
 * empty (état vide), oops (erreur), party (correspondance, restitution).
 */

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { PIN_PATH } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export type MascotMood = "wave" | "search" | "scan" | "empty" | "oops" | "party";

const INK = "#0E1A16";
const EMERALD = "#0F5C47";
const ORANGE = "#F08A24";

interface MascotProps {
  mood?: MascotMood;
  className?: string;
  /** La pupille suit le pointeur de la souris. */
  followPointer?: boolean;
  label?: string;
}

const MOOD_LABEL: Record<MascotMood, string> = {
  wave: "Ori, la mascotte d'Orea, te fait coucou",
  search: "Ori cherche avec sa loupe",
  scan: "Ori lit la pièce",
  empty: "Ori hausse les épaules : rien ici pour l'instant",
  oops: "Ori est tout étourdi : une erreur est survenue",
  party: "Ori saute de joie",
};

export function Mascot({ mood = "wave", className, followPointer = false, label }: MascotProps) {
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  // La pupille suit la souris (limitée à l'intérieur de l'anneau).
  useEffect(() => {
    if (!followPointer || reduce) return;
    const onMove = (event: PointerEvent) => {
      const box = svgRef.current?.getBoundingClientRect();
      if (!box) return;
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height * 0.38);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, distance / 300) * 11;
      setLook({ x: (dx / distance) * reach, y: (dy / distance) * reach });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [followPointer, reduce]);

  // Clignement des yeux de temps en temps.
  useEffect(() => {
    if (reduce || mood === "oops") return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        schedule();
      }, 2600 + Math.random() * 2600);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [mood, reduce]);

  const searching = mood === "search" && !reduce;
  const pupil =
    mood === "empty" ? { x: 0, y: 6 } : mood === "scan" ? { x: 0, y: 9 } : searching ? undefined : look;

  const bodyAnimation = reduce
    ? undefined
    : mood === "party"
      ? { y: [0, -18, 0], rotate: [0, -4, 4, 0] }
      : mood === "oops"
        ? { rotate: [-3, 3, -3] }
        : { y: [0, -5, 0] };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 250"
      className={cn("h-40 w-auto overflow-visible", className)}
      role="img"
      aria-label={label ?? MOOD_LABEL[mood]}
    >
      {/* Ombre au sol */}
      <motion.ellipse
        cx="100"
        cy="236"
        rx="44"
        ry="7"
        fill={INK}
        opacity={0.12}
        animate={reduce ? undefined : mood === "party" ? { rx: [44, 30, 44] } : { rx: [44, 40, 44] }}
        transition={{ duration: mood === "party" ? 0.7 : 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.g
        style={{ originX: "100px", originY: "230px" }}
        animate={bodyAnimation}
        transition={{
          duration: mood === "party" ? 0.7 : mood === "oops" ? 0.5 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Pieds */}
        <ellipse cx="82" cy="222" rx="13" ry="7" fill={INK} />
        <ellipse cx="118" cy="222" rx="13" ry="7" fill={INK} />

        {/* Bras gauche */}
        <Arm side="left" mood={mood} reduce={!!reduce} />
        {/* Bras droit */}
        <Arm side="right" mood={mood} reduce={!!reduce} />

        {/* Corps : la silhouette exacte de l'épingle */}
        <g transform="translate(30 30)">
          <path d={PIN_PATH} fill={EMERALD} stroke={INK} strokeWidth="5" />
        </g>

        {/* Joues */}
        <ellipse cx="58" cy="126" rx="9" ry="5" fill={ORANGE} opacity={0.45} />
        <ellipse cx="142" cy="126" rx="9" ry="5" fill={ORANGE} opacity={0.45} />

        {/* L'œil : anneau blanc + pupille orange */}
        <circle cx="100" cy="100" r="35" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
        {mood === "oops" ? (
          <motion.path
            d="M100 100 m-3 0 a3 3 0 1 1 6 0 a7 7 0 1 1 -14 0 a11 11 0 1 1 22 0 a15 15 0 1 1 -30 0"
            fill="none"
            stroke={ORANGE}
            strokeWidth="4"
            strokeLinecap="round"
            style={{ originX: "100px", originY: "100px" }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <motion.g
            animate={
              searching
                ? { x: [-10, 10, 10, -10, -10], y: [-4, -4, 6, 6, -4] }
                : { x: pupil?.x ?? 0, y: pupil?.y ?? 0 }
            }
            transition={
              searching
                ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
                : { type: "spring", stiffness: 260, damping: 20 }
            }
          >
            <circle cx="100" cy="100" r="16" fill={ORANGE} />
            <circle cx="106" cy="94" r="4.5" fill="#FFFFFF" opacity={0.9} />
          </motion.g>
        )}
        {/* Paupière (clignement) */}
        <motion.rect
          x="64"
          y="64"
          width="72"
          height="72"
          rx="36"
          fill={EMERALD}
          initial={false}
          animate={{ scaleY: blink ? 1 : 0 }}
          style={{ originX: "100px", originY: "64px" }}
          transition={{ duration: 0.08 }}
        />

        {/* Sourcils selon l'humeur */}
        {mood === "empty" && (
          <path d="M78 58 Q100 50 122 58" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        )}
        {mood === "party" && (
          <path d="M80 56 Q100 44 120 56" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        )}

        {/* Bouche */}
        {mood === "oops" ? (
          <path d="M88 152 Q100 144 112 152" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        ) : mood === "empty" ? (
          <path d="M90 150 L110 150" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        ) : (
          <path
            d={mood === "party" ? "M84 146 Q100 168 116 146 Z" : "M88 146 Q100 158 112 146"}
            stroke={INK}
            strokeWidth="5"
            fill={mood === "party" ? INK : "none"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Accessoires */}
        {mood === "search" && <Magnifier reduce={!!reduce} />}
        {mood === "scan" && <ScanCard reduce={!!reduce} />}
        {mood === "party" && <PartyBits reduce={!!reduce} />}
      </motion.g>
    </svg>
  );
}

function Arm({ side, mood, reduce }: { side: "left" | "right"; mood: MascotMood; reduce: boolean }) {
  const left = side === "left";
  const shoulder = left ? { x: 40, y: 128 } : { x: 160, y: 128 };

  // Formes de bras par humeur (coudes et mains).
  let d: string;
  if (mood === "party" || mood === "empty") {
    d = left ? "M40 128 Q18 104 22 78" : "M160 128 Q182 104 178 78";
  } else if (mood === "wave" && !left) {
    d = "M160 128 Q188 110 184 78";
  } else if (mood === "search" && !left) {
    d = "M160 128 Q180 140 176 160";
  } else if (mood === "scan") {
    d = left ? "M40 128 Q30 156 56 176" : "M160 128 Q170 156 144 176";
  } else {
    d = left ? "M40 128 Q20 150 30 170" : "M160 128 Q180 150 170 170";
  }
  const hand = d.split(" ").slice(-2).join(" ").split(" ");
  const [hx, hy] = [Number(hand[0]), Number(hand[1])];

  const waving = mood === "wave" && !left && !reduce;
  return (
    <motion.g
      style={{ originX: `${shoulder.x}px`, originY: `${shoulder.y}px` }}
      animate={waving ? { rotate: [0, 18, -6, 18, 0] } : undefined}
      transition={waving ? { duration: 1.4, repeat: Infinity, repeatDelay: 0.8 } : undefined}
    >
      <path d={d} stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
      <circle cx={hx} cy={hy} r="8" fill={INK} />
    </motion.g>
  );
}

function Magnifier({ reduce }: { reduce: boolean }) {
  return (
    <motion.g
      animate={reduce ? undefined : { rotate: [-8, 8, -8] }}
      style={{ originX: "176px", originY: "160px" }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <line x1="176" y1="160" x2="190" y2="182" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <circle cx="168" cy="148" r="18" fill="#EAF3EF" fillOpacity={0.6} stroke={INK} strokeWidth="6" />
    </motion.g>
  );
}

function ScanCard({ reduce }: { reduce: boolean }) {
  return (
    <g>
      <rect x="58" y="166" width="84" height="52" rx="8" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
      <rect x="66" y="176" width="20" height="24" rx="3" fill="#B5E8D4" />
      <rect x="92" y="178" width="40" height="5" rx="2.5" fill={INK} opacity={0.6} />
      <rect x="92" y="190" width="30" height="5" rx="2.5" fill={INK} opacity={0.4} />
      <rect x="92" y="202" width="36" height="5" rx="2.5" fill={INK} opacity={0.4} />
      <motion.rect
        x="54"
        width="92"
        height="4"
        rx="2"
        fill={ORANGE}
        animate={reduce ? { y: 190 } : { y: [168, 212, 168] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}

function PartyBits({ reduce }: { reduce: boolean }) {
  const bits = [
    { x: 30, y: 40, c: ORANGE, d: 0 },
    { x: 170, y: 34, c: EMERALD, d: 0.2 },
    { x: 14, y: 96, c: "#8CD2B8", d: 0.4 },
    { x: 188, y: 100, c: ORANGE, d: 0.1 },
    { x: 100, y: 8, c: "#8CD2B8", d: 0.3 },
  ];
  return (
    <g>
      {bits.map((bit, index) => (
        <motion.rect
          key={index}
          x={bit.x}
          y={bit.y}
          width="9"
          height="9"
          rx="2"
          fill={bit.c}
          animate={reduce ? undefined : { y: [bit.y, bit.y - 10, bit.y], rotate: [0, 90, 180] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: bit.d }}
        />
      ))}
    </g>
  );
}
