"use client";

/**
 * « Pourquoi c'est ta pièce ? » : jauge de confiance animée + raisons lisibles.
 * Orea explique sa décision (IA explicable) sans jamais révéler de donnée :
 * on dit QUE les éléments concordent, pas leur valeur.
 */

import { Check } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export function ConfidenceRing({ score, size = 88, className }: { score: number; size?: number; className?: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const value = Math.min(100, Math.max(0, Math.round(score)));
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth="10" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#F08A24"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - value / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <span>
          <span className="font-heading text-xl font-extrabold">{value}</span>
          <span className="text-xs font-bold">%</span>
        </span>
      </div>
      <span className="sr-only">Confiance de la correspondance : {value} %</span>
    </div>
  );
}

export function MatchExplainer({ score, reasons, className }: { score: number; reasons: string[]; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <ConfidenceRing score={score} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">Pourquoi Orea pense que c&apos;est la tienne</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {reasons.map((reason, index) => (
            <motion.li
              key={reason}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + index * 0.12 }}
              className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-medium ring-1 ring-border"
            >
              <Check className="size-3 text-primary" strokeWidth={3} /> {reason}
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
