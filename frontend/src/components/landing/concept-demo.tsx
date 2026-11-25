"use client";

/**
 * Animation du hero : le concept d'Orea en 3 temps, en boucle.
 *   1. une pièce est photographiée ;
 *   2. le formulaire se remplit tout seul (le numéro reste masqué) ;
 *   3. le propriétaire reçoit « Bonne nouvelle, ta CNI t'attend à Cocody ! ».
 * Avec « réduire les animations », la boucle s'arrête : on navigue avec les étapes.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Camera, Check, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { PinMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "On photographie", duration: 3200 },
  { label: "Ça se remplit tout seul", duration: 3800 },
  { label: "Le propriétaire est prévenu", duration: 4200 },
];

const FIELDS = [
  ["Type de pièce", "Carte nationale d'identité"],
  ["Nom et prénoms", "KOUASSI Aya Marie"],
  ["Né(e) le", "12/04/1998"],
  ["Numéro", "•••• •••• •• 56"],
];

export function ConceptDemo() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const timer = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEPS[step].duration);
    return () => clearTimeout(timer);
  }, [step, reduce, paused]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="surface relative overflow-hidden bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PinMark className="h-5" />
            Orea
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold" aria-live="polite">
            Étape {step + 1}/3 · {STEPS[step].label}
          </span>
        </div>

        <div className="relative h-[268px]">
          <AnimatePresence mode="wait">
            {step === 0 && <PhotoStep key="photo" />}
            {step === 1 && <FormStep key="form" />}
            {step === 2 && <MatchStep key="match" />}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation entre les étapes (utile au clavier et sans animation). */}
      <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Étapes de la démonstration">
        {STEPS.map((s, index) => (
          <button
            key={s.label}
            type="button"
            role="tab"
            aria-selected={step === index}
            aria-label={`Étape ${index + 1} : ${s.label}`}
            onClick={() => setStep(index)}
            className={cn(
              "h-2.5 rounded-full border border-border transition-all",
              step === index ? "w-10 bg-highlight" : "w-2.5 bg-card",
            )}
          />
        ))}
      </div>
    </div>
  );
}

const enter = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
  transition: { duration: 0.35 },
};

function PhotoStep() {
  return (
    <motion.div {...enter} className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="relative">
        {/* Pièce fictive */}
        <div className="relative h-36 w-60 rotate-[-3deg] overflow-hidden rounded-2xl border border-border bg-mint p-3 text-[#0E1A16]">
          <div className="h-3 w-32 rounded-full bg-brand-700/80" />
          <div className="mt-3 flex gap-3">
            <div className="h-20 w-16 rounded-lg bg-brand-200" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-2.5 w-24 rounded-full bg-[#0E1A16]/70" />
              <div className="h-2.5 w-20 rounded-full bg-[#0E1A16]/35" />
              <div className="h-2.5 w-28 rounded-full bg-[#0E1A16]/35" />
              <div className="h-2.5 w-16 rounded-full bg-[#0E1A16]/35" />
            </div>
          </div>
          <span className="absolute top-12 left-6 rotate-[-18deg] font-heading text-2xl font-extrabold text-red-500/30">
            SPÉCIMEN
          </span>
          {/* Faisceau de scan */}
          <motion.div
            className="absolute inset-x-0 h-1 bg-highlight shadow-[0_0_16px_4px_rgba(240,138,36,0.6)]"
            initial={{ top: "5%" }}
            animate={{ top: ["5%", "92%", "5%"] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        {/* Coins du viseur */}
        {["-top-3 -left-3 border-t-4 border-l-4", "-top-3 -right-3 border-t-4 border-r-4", "-bottom-3 -left-3 border-b-4 border-l-4", "-bottom-3 -right-3 border-b-4 border-r-4"].map((c) => (
          <span key={c} className={cn("absolute size-6 rounded-sm border-highlight", c)} />
        ))}
      </div>
      <motion.div
        className="mt-8 flex items-center gap-2 rounded-full border border-border bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        initial={{ scale: 0.9 }}
        animate={{ scale: [0.9, 1.05, 1] }}
        transition={{ delay: 1.4, duration: 0.4 }}
      >
        <Camera className="size-4" /> Clic ! Photo prise
      </motion.div>
    </motion.div>
  );
}

function FormStep() {
  return (
    <motion.div {...enter} className="absolute inset-0 space-y-3">
      {FIELDS.map(([label, value], index) => (
        <div key={label}>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <div className="mt-1 flex h-10 items-center rounded-xl border border-input bg-background px-3 text-sm font-semibold">
            <Typewriter text={value} delay={0.25 + index * 0.75} />
            <motion.span
              className="ml-auto text-primary"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + index * 0.75 + 0.6 }}
            >
              <Check className="size-4" aria-hidden />
            </motion.span>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function Typewriter({ text, delay }: { text: string; delay: number }) {
  return (
    <span aria-label={text}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + i * 0.022, duration: 0.01 }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

function MatchStep() {
  return (
    <motion.div {...enter} className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="relative grid place-items-center">
        {[0, 0.8, 1.6].map((d) => (
          <motion.span
            key={d}
            className="absolute size-20 rounded-full border-4 border-highlight"
            initial={{ scale: 0.6, opacity: 0.7 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: d, ease: "easeOut" }}
          />
        ))}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14 }}
        >
          <PinMark className="h-20" />
        </motion.div>
      </div>
      <motion.div
        className="mt-8 w-full max-w-sm rounded-2xl border border-border bg-highlight p-4 text-highlight-foreground"
        initial={{ y: 30, opacity: 0, rotate: -2 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 18 }}
      >
        <p className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
          <Sparkles className="size-4" /> Correspondance trouvée
        </p>
        <p className="mt-1 font-heading text-lg leading-tight font-bold">
          Bonne nouvelle, ta CNI t&apos;attend à Cocody !
        </p>
      </motion.div>
    </motion.div>
  );
}
