"use client";

/**
 * Illustrations vectorielles des 6 pièces acceptées, aux couleurs d'Orea.
 *
 * Garde-fous : ce sont des visuels de démonstration, pas des reproductions de
 * documents officiels (aucun emblème, aucune mention d'État, noms fictifs,
 * mention « SPÉCIMEN »).
 *
 * <HoloCard> ajoute une inclinaison 3D qui suit le pointeur et un reflet
 * holographique, comme une vraie carte qu'on fait bouger sous la lumière.
 */

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { DocType } from "@/lib/types";

const INK = "#0E1A16";
const EMERALD = "#0F5C47";
const ORANGE = "#F08A24";
const MINT = "#EAF3EF";
const FONT = { fontFamily: "var(--font-inter), Arial, sans-serif" };
const HEAD = { fontFamily: "var(--font-sora), var(--font-inter), Arial, sans-serif" };

/* ---------------------------------------------------------------------------
 * Éléments communs
 * ------------------------------------------------------------------------- */
function Portrait({ x, y, w, h, bg, tone }: { x: number; y: number; w: number; h: number; bg: string; tone: string }) {
  // Identifiant unique : la même carte peut apparaître plusieurs fois dans la page.
  const clip = `portrait-${useId().replace(/:/g, "")}`;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={bg} />
      <clipPath id={clip}>
        <rect x={x} y={y} width={w} height={h} rx={8} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <circle cx={x + w / 2} cy={y + h * 0.4} r={w * 0.22} fill={tone} />
        <ellipse cx={x + w / 2} cy={y + h * 1.02} rx={w * 0.42} ry={h * 0.36} fill={tone} />
      </g>
    </g>
  );
}

function Chip({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={34} height={26} rx={6} fill="#F6C27E" stroke="#C98A3A" strokeWidth={1} />
      <path d={`M${x + 11} ${y} v26 M${x + 23} ${y} v26 M${x} ${y + 9} h11 M${x + 23} ${y + 9} h11 M${x} ${y + 17} h11 M${x + 23} ${y + 17} h11`} stroke="#C98A3A" strokeWidth={1} />
    </g>
  );
}

function Field({ x, y, label, value, color = INK, size = 13 }: { x: number; y: number; label: string; value: string; color?: string; size?: number }) {
  return (
    <g style={FONT}>
      <text x={x} y={y} fontSize={7.5} fontWeight={600} fill={color} opacity={0.55} letterSpacing={0.8}>
        {label}
      </text>
      <text x={x} y={y + size + 2} fontSize={size} fontWeight={700} fill={color}>
        {value}
      </text>
    </g>
  );
}

function Waves({ color, opacity = 0.12 }: { color: string; opacity?: number }) {
  return (
    <g opacity={opacity} fill="none" stroke={color} strokeWidth={1}>
      {Array.from({ length: 9 }).map((_, i) => (
        <path key={i} d={`M-10 ${120 + i * 9} C 60 ${90 + i * 9}, 120 ${160 + i * 9}, 200 ${120 + i * 9} S 330 ${90 + i * 9}, 360 ${130 + i * 9}`} />
      ))}
    </g>
  );
}

function PinEmblem({ x, y, s, body = EMERALD, ring = "#FFFFFF" }: { x: number; y: number; s: number; body?: string; ring?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 140})`}>
      <path d="M70 0C108.66 0 140 31.34 140 70C140 104.5 109.6 134 79.6 170.6C74.6 176.7 65.4 176.7 60.4 170.6C30.4 134 0 104.5 0 70C0 31.34 31.34 0 70 0Z" fill={body} />
      <circle cx={70} cy={70} r={34} fill={ring} />
      <circle cx={70} cy={70} r={16} fill={ORANGE} />
    </g>
  );
}

function Specimen({ x, y, color = INK }: { x: number; y: number; color?: string }) {
  return (
    <text x={x} y={y} fontSize={7} fontWeight={700} letterSpacing={1.5} fill={color} opacity={0.4} style={FONT}>
      SPÉCIMEN · ILLUSTRATION
    </text>
  );
}

/* ---------------------------------------------------------------------------
 * Les 6 pièces (format carte : 340 × 214, passeport : 230 × 320)
 * ------------------------------------------------------------------------- */
function Cni() {
  return (
    <svg viewBox="0 0 340 214" aria-hidden className="block h-full w-auto">
      <rect width={340} height={214} rx={18} fill={MINT} />
      <Waves color={EMERALD} />
      <rect width={340} height={46} rx={18} fill={EMERALD} />
      <rect y={28} width={340} height={18} fill={EMERALD} />
      <PinEmblem x={14} y={9} s={22} body="#FFFFFF" ring={EMERALD} />
      <text x={42} y={30} fontSize={14} fontWeight={800} fill="#FFFFFF" style={HEAD} letterSpacing={0.5}>CARTE D&apos;IDENTITÉ</text>
      <Portrait x={18} y={60} w={78} h={98} bg="#B5E8D4" tone="#4E937B" />
      <Chip x={290} y={60} />
      <Field x={112} y={72} label="NOM" value="KOUASSI" />
      <Field x={112} y={104} label="PRÉNOMS" value="AYA MARIE" />
      <Field x={112} y={136} label="NÉ(E) LE" value="12.04.1998" size={11} />
      <Field x={214} y={136} label="SEXE" value="F" size={11} />
      <text x={18} y={186} fontSize={10} fill={INK} opacity={0.55} style={{ fontFamily: "monospace" }} letterSpacing={1.6}>
        IDCI&lt;&lt;KOUASSI&lt;&lt;AYA&lt;MARIE&lt;&lt;&lt;&lt;
      </text>
      <Specimen x={18} y={203} />
    </svg>
  );
}

function Passeport() {
  return (
    <svg viewBox="0 0 230 320" aria-hidden className="block h-full w-auto">
      <rect width={230} height={320} rx={18} fill={EMERALD} />
      <rect x={10} y={10} width={210} height={300} rx={12} fill="none" stroke="#8CD2B8" strokeOpacity={0.35} strokeWidth={1.5} />
      <g opacity={0.08} fill="none" stroke="#FFFFFF">
        {Array.from({ length: 7 }).map((_, i) => (
          <circle key={i} cx={115} cy={150} r={30 + i * 18} />
        ))}
      </g>
      <text x={115} y={62} textAnchor="middle" fontSize={22} fontWeight={800} fill="#FFFFFF" style={HEAD} letterSpacing={3}>PASSEPORT</text>
      <text x={115} y={80} textAnchor="middle" fontSize={8} fontWeight={600} fill="#8CD2B8" style={FONT} letterSpacing={2}>PASSPORT</text>
      <circle cx={115} cy={155} r={44} fill="none" stroke={ORANGE} strokeWidth={2.5} />
      <PinEmblem x={93} y={123} s={44} body={ORANGE} ring={EMERALD} />
      <g transform="translate(97 248)">
        <rect width={36} height={24} rx={4} fill="none" stroke="#F6C27E" strokeWidth={2} />
        <circle cx={18} cy={12} r={5} fill="none" stroke="#F6C27E" strokeWidth={2} />
        <path d="M0 12h13M23 12h13" stroke="#F6C27E" strokeWidth={2} />
      </g>
      <text x={115} y={300} textAnchor="middle" fontSize={7} fontWeight={700} letterSpacing={1.5} fill="#FFFFFF" opacity={0.45} style={FONT}>SPÉCIMEN · ILLUSTRATION</text>
    </svg>
  );
}

function Permis() {
  return (
    <svg viewBox="0 0 340 214" aria-hidden className="block h-full w-auto">
      <rect width={340} height={214} rx={18} fill="#B5E8D4" />
      <Waves color={INK} opacity={0.08} />
      <text x={18} y={34} fontSize={15} fontWeight={800} fill={INK} style={HEAD}>PERMIS DE CONDUIRE</text>
      <circle cx={306} cy={30} r={16} fill={ORANGE} />
      <text x={306} y={36} textAnchor="middle" fontSize={16} fontWeight={800} fill={INK} style={HEAD}>B</text>
      <Portrait x={18} y={50} w={74} h={94} bg="#FFFFFF" tone="#6DB299" />
      <Field x={108} y={62} label="1. NOM" value="KONAN" />
      <Field x={108} y={94} label="2. PRÉNOMS" value="YAO FABRICE" />
      <Field x={108} y={126} label="3. DATE DE NAISSANCE" value="03.09.1990" size={11} />
      <g transform="translate(236 150)" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 30 L12 14 Q14 10 20 10 H62 Q68 10 70 14 L76 30" />
        <rect x={2} y={28} width={78} height={16} rx={6} fill={EMERALD} stroke={INK} />
        <circle cx={18} cy={46} r={7} fill={INK} />
        <circle cx={64} cy={46} r={7} fill={INK} />
      </g>
      <Field x={18} y={164} label="5. N° DU PERMIS" value="AB 4521 7788" size={11} />
      <Specimen x={18} y={203} />
    </svg>
  );
}

function CarteEtudiant() {
  return (
    <svg viewBox="0 0 340 214" aria-hidden className="block h-full w-auto">
      <rect width={340} height={214} rx={18} fill={ORANGE} />
      <circle cx={318} cy={-10} r={90} fill="#FFA151" />
      <circle cx={-20} cy={230} r={70} fill="#CB7214" opacity={0.5} />
      <text x={18} y={34} fontSize={15} fontWeight={800} fill={INK} style={HEAD}>CARTE D&apos;ÉTUDIANT</text>
      <text x={18} y={50} fontSize={8} fontWeight={600} fill={INK} opacity={0.65} style={FONT} letterSpacing={1}>ANNÉE ACADÉMIQUE 2026 – 2027</text>
      <Portrait x={18} y={62} w={72} h={90} bg="#FFECDE" tone="#CB7214" />
      <Field x={106} y={76} label="NOM" value="TRAORÉ" />
      <Field x={106} y={108} label="PRÉNOMS" value="AWA" />
      <Field x={106} y={140} label="FILIÈRE" value="INFORMATIQUE" size={11} />
      <g transform="translate(236 128)">
        <rect width={88} height={42} rx={6} fill="#FFFFFF" />
        {[4, 9, 12, 18, 21, 27, 30, 36, 41, 44, 50, 55, 58, 64, 69, 72, 78].map((bx, i) => (
          <rect key={bx} x={4 + bx} y={6} width={i % 3 === 0 ? 3 : 1.6} height={30} fill={INK} />
        ))}
      </g>
      <Specimen x={18} y={203} />
    </svg>
  );
}

function CarteGrise() {
  return (
    <svg viewBox="0 0 340 214" aria-hidden className="block h-full w-auto">
      <rect width={340} height={214} rx={18} fill="#FFD9BD" />
      <Waves color={EMERALD} opacity={0.1} />
      <rect x={0} y={0} width={14} height={214} rx={0} fill={EMERALD} />
      <rect x={0} y={0} width={24} height={214} rx={18} fill={EMERALD} />
      <text x={38} y={34} fontSize={15} fontWeight={800} fill={INK} style={HEAD}>CARTE GRISE</text>
      <text x={38} y={50} fontSize={8} fontWeight={600} fill={INK} opacity={0.6} style={FONT} letterSpacing={1}>CERTIFICAT D&apos;IMMATRICULATION</text>
      <g transform="translate(38 64)">
        <rect width={150} height={40} rx={8} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
        <rect width={22} height={40} rx={8} fill={EMERALD} />
        <text x={86} y={27} textAnchor="middle" fontSize={17} fontWeight={800} fill={INK} style={HEAD} letterSpacing={1}>AB-1234-CI</text>
      </g>
      <Field x={38} y={124} label="MARQUE" value="ORÉA MOTORS" size={11} />
      <Field x={160} y={124} label="GENRE" value="VP" size={11} />
      <Field x={38} y={156} label="TITULAIRE" value="BAMBA SEYDOU" size={11} />
      <g transform="translate(226 70)" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 46 L18 22 Q21 16 29 16 H71 Q79 16 82 22 L92 46" />
        <rect x={2} y={42} width={96} height={22} rx={8} fill={ORANGE} />
        <circle cx={22} cy={66} r={9} fill={INK} />
        <circle cx={78} cy={66} r={9} fill={INK} />
      </g>
      <Specimen x={38} y={203} />
    </svg>
  );
}

function Attestation() {
  return (
    <svg viewBox="0 0 340 214" aria-hidden className="block h-full w-auto">
      <rect width={340} height={214} rx={18} fill="#FFFFFF" />
      <rect x={8} y={8} width={324} height={198} rx={12} fill="none" stroke={EMERALD} strokeWidth={2} strokeDasharray="1 0" />
      <rect x={14} y={14} width={312} height={186} rx={9} fill="none" stroke="#8CD2B8" strokeWidth={1} />
      <text x={170} y={42} textAnchor="middle" fontSize={15} fontWeight={800} fill={EMERALD} style={HEAD} letterSpacing={0.5}>ATTESTATION D&apos;IDENTITÉ</text>
      <path d="M110 52 H230" stroke={ORANGE} strokeWidth={2} strokeLinecap="round" />
      <Portrait x={28} y={66} w={66} h={82} bg={MINT} tone="#4E937B" />
      <Field x={110} y={78} label="NOM ET PRÉNOMS" value="DIALLO MARIAM" size={12} />
      {[112, 126, 140].map((y, i) => (
        <rect key={y} x={110} y={y} width={i === 2 ? 110 : 150} height={5} rx={2.5} fill={INK} opacity={0.15} />
      ))}
      <g transform="translate(262 128)">
        <circle r={30} fill="none" stroke={ORANGE} strokeWidth={2.5} />
        <circle r={22} fill="none" stroke={ORANGE} strokeWidth={1.2} strokeDasharray="3 3" />
        <PinEmblem x={-11} y={-15} s={22} body={ORANGE} ring="#FFFFFF" />
      </g>
      <path d="M110 176 c10 -14 18 6 26 -6 s 14 -4 22 2 s 10 -8 18 -2" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <Specimen x={28} y={196} />
    </svg>
  );
}

export const DOC_CARDS: Record<DocType, () => ReactNode> = {
  cni: Cni,
  passeport: Passeport,
  permis: Permis,
  carte_etudiant: CarteEtudiant,
  carte_grise: CarteGrise,
  attestation: Attestation,
};

export function DocCard({ type, className }: { type: DocType; className?: string }) {
  const Card = DOC_CARDS[type];
  return (
    <div className={cn("overflow-hidden rounded-[6%/9%] shadow-[0_18px_40px_-18px_rgba(14,26,22,0.55)]", type === "passeport" && "rounded-[8%/6%]", className)}>
      <Card />
    </div>
  );
}

/**
 * Carte « vivante » : elle s'incline vers le pointeur et un reflet holographique
 * glisse à sa surface. Sans effet si « réduire les animations » est activé.
 */
export function HoloCard({ type, className, intensity = 14 }: { type: DocType; className?: string; intensity?: number }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [intensity, -intensity]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(px, [0, 1], [-intensity, intensity]), { stiffness: 220, damping: 18 });
  const sheenX = useTransform(px, [0, 1], [0, 100]);
  const sheenY = useTransform(py, [0, 1], [0, 100]);
  const sheen = useMotionTemplate`radial-gradient(circle at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%), linear-gradient(115deg, rgba(140,210,184,0) 30%, rgba(140,210,184,0.35) 45%, rgba(255,193,142,0.35) 55%, rgba(255,193,142,0) 70%)`;

  return (
    <motion.div
      className={cn("relative [perspective:900px]", className)}
      onPointerMove={(e) => {
        if (reduce) return;
        const box = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - box.left) / box.width);
        py.set((e.clientY - box.top) / box.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
    >
      <motion.div style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} className="relative h-full">
        <DocCard type={type} className="h-full" />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[6%/9%] mix-blend-soft-light"
          style={{ backgroundImage: sheen }}
        />
      </motion.div>
    </motion.div>
  );
}
