"use client";

/**
 * Collage du hero : des formes organiques colorées qui racontent le concept.
 *  - le bloc émeraude : un téléphone photographie une pièce (faisceau de scan) ;
 *  - la notification : « Bonne nouvelle, ta CNI t'attend à Cocody ! » ;
 *  - les cartes noire et menthe : les vraies statistiques de l'API.
 * Les positions sont en pourcentages et les textes en unités de conteneur (cqw) :
 * le collage garde exactement ses proportions, du téléphone au grand écran.
 */

import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

import { PinMark } from "@/components/brand/logo";
import { DocCard } from "@/components/illustrations/id-cards";
import { Mascot } from "@/components/brand/mascot";
import { AnimatedCounter } from "@/components/common/motion";
import { api } from "@/lib/api";
import type { PublicStats } from "@/lib/types";
import { cn } from "@/lib/utils";

function Piece({
  x,
  y,
  w,
  h,
  delay = 0,
  className,
  children,
  float = false,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  delay?: number;
  className?: string;
  children?: ReactNode;
  float?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("absolute", className)}
      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: h ? `${h}%` : undefined, aspectRatio: h ? undefined : "1" }}
      initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -8 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 18, delay }}
    >
      <div className={cn("size-full", float && !reduce && "animate-float")} style={{ animationDelay: `${delay * 2}s` }}>
        {children}
      </div>
    </motion.div>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M50 2 L56 40 L92 22 L62 48 L98 56 L60 60 L74 96 L50 66 L26 96 L40 60 L2 56 L38 48 L8 22 L44 40 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeroCollage() {
  const reduce = useReducedMotion();
  const { data } = useQuery({ queryKey: ["public-stats"], queryFn: () => api<PublicStats>("/stats/public") });
  const [toast, setToast] = useState(false);

  // La notification de correspondance apparaît puis disparaît, en boucle.
  useEffect(() => {
    if (reduce) return;
    let visible = false;
    const first = setTimeout(() => setToast((visible = true)), 1800);
    const loop = setInterval(() => {
      visible = !visible;
      setToast(visible);
    }, 3600);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
    };
  }, [reduce]);

  return (
    <div className="@container relative mx-auto aspect-square w-full max-w-[580px]" aria-hidden>
      {/* Petit cercle en contour */}
      <Piece x={30} y={0} w={5} delay={0.5}>
        <span className="block size-full rounded-full border-[2.5px] border-ink" />
      </Piece>

      {/* Rond orange : Ori fait coucou */}
      <Piece x={1} y={3} w={31} delay={0.05}>
        <div className="relative size-full overflow-hidden rounded-full bg-highlight">
          <Mascot mood="wave" className="absolute -bottom-[6%] left-1/2 h-[92%] -translate-x-1/2" />
        </div>
      </Piece>

      {/* Carte noire : pièces signalées */}
      <Piece x={35} y={5} w={35} h={34} delay={0.15}>
        <div className="shape-leaf-r flex size-full flex-col justify-between bg-[#0E1A16] pt-[24%] dark:bg-[#21423A] pr-[10%] pb-[10%] pl-[20%] text-white">
          <p className="text-[3.3cqw] leading-tight font-medium text-white/80">
            Pièces
            <br />
            signalées
          </p>
          <p className="self-end font-heading text-[6.4cqw] font-bold tracking-tight">
            <AnimatedCounter value={data?.documents_found ?? 0} />
          </p>
        </div>
      </Piece>

      {/* Pilule menthe : une pièce d'identité */}
      <Piece x={73} y={1} w={25} h={44} delay={0.25} float>
        <div className="relative grid size-full place-items-center overflow-hidden rounded-full bg-brand-300">
          <DocCard type="passeport" className="h-[70%] rotate-[-10deg]" />
        </div>
      </Piece>

      {/* Bloc émeraude : le téléphone photographie la pièce */}
      <Piece x={0} y={35} w={42} h={42} delay={0.2}>
        <div className="relative size-full overflow-hidden rounded-[11cqw] rounded-tr-[4cqw] bg-brand-700">
          <div className="absolute top-[12%] left-[9%] h-[40%] -rotate-6">
            <DocCard type="cni" className="h-full" />
          </div>
          <div className="absolute right-[10%] bottom-[-8%] h-[74%] w-[40%] rotate-[10deg] rounded-[3cqw] border-[0.6cqw] border-[#0E1A16] bg-[#0E1A16] p-[4%]">
            <div className="relative size-full overflow-hidden rounded-[2cqw] bg-mint">
              <PinMark className="absolute top-1/2 left-1/2 h-[42%] -translate-x-1/2 -translate-y-1/2" />
              <motion.span
                className="absolute inset-x-0 h-[3%] bg-highlight shadow-[0_0_14px_3px_rgba(240,138,36,0.7)]"
                animate={reduce ? { top: "45%" } : { top: ["8%", "88%", "8%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        </div>
      </Piece>

      {/* Étoile */}
      <Piece x={45} y={44} w={17} delay={0.45}>
        <Sparkle className="size-full animate-spin-slow text-ink" />
      </Piece>

      {/* Quart de cercle orange clair */}
      <Piece x={70} y={47} w={22} h={23} delay={0.35}>
        <span className="block size-full rounded-tr-full rounded-br-[3cqw] bg-glow-300" />
      </Piece>

      {/* Carte menthe : pièces rendues */}
      <Piece x={31} y={66} w={31} h={31} delay={0.3}>
        <div className="shape-leaf flex size-full flex-col justify-between bg-brand-200 p-[13%] text-[#0E1A16]">
          <p className="pl-[8%] text-[3.2cqw] leading-tight font-medium">
            Pièces
            <br />
            rendues
          </p>
          <p className="font-heading text-[6.2cqw] font-bold tracking-tight">
            <AnimatedCounter value={data?.documents_returned ?? 0} />
          </p>
        </div>
      </Piece>

      {/* Rond orange vif */}
      <Piece x={66} y={73} w={15} delay={0.5} float>
        <span className="block size-full rounded-full bg-highlight" />
      </Piece>

      {/* Petit triangle en contour */}
      <Piece x={63} y={90} w={4.5} delay={0.6}>
        <svg viewBox="0 0 20 20" className="size-full rotate-12 text-ink" aria-hidden>
          <path d="M3 3 L17 10 L3 17 Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      </Piece>

      {/* Notification de correspondance (le « déclic » du concept) */}
      <div className="absolute right-[-2%] bottom-[2%] left-[56%] sm:left-[60%]">
        <AnimatePresence>
          {(toast || reduce) && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="rounded-[3.4cqw] bg-card p-[3cqw] shadow-[0_18px_40px_-16px_rgba(14,26,22,0.45)] ring-1 ring-border"
            >
              <p className="flex items-center gap-[1.2cqw] text-[2.3cqw] font-bold tracking-wide text-glow-700 uppercase dark:text-glow-400">
                <Sparkles className="size-[2.8cqw]" /> Correspondance
              </p>
              <p className="mt-[0.8cqw] font-heading text-[3cqw] leading-snug font-bold">
                Bonne nouvelle, ta CNI t&apos;attend à Cocody !
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
