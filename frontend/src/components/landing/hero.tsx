"use client";

import { Camera, Search } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { HeroCollage } from "@/components/landing/hero-collage";
import { LiveTicker } from "@/components/live/live-ticker";
import { ArrowBadge, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "lost" | "found";

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function Hero() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("lost");
  const [name, setName] = useState("");

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    router.push(name.trim() ? `/recherche?nom=${encodeURIComponent(name.trim())}` : "/recherche");
  };

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pt-16 lg:pb-24">
        <div className="min-w-0 max-w-xl">
          <motion.p {...rise(0)} className="eyebrow">
            Pièces perdues & retrouvées · Abidjan
          </motion.p>

          <motion.h1 {...rise(0.06)} className="display mt-5 text-[2.7rem] sm:text-6xl lg:text-[4.1rem] xl:text-[4.4rem]">
            Perdu ta pièce&nbsp;?
            <br />
            On la retrouve
            <br />
            <span className="highlight-marker">ensemble</span>.
          </motion.h1>

          <motion.p {...rise(0.12)} className="mt-6 max-w-md text-lg text-muted-foreground sm:text-xl">
            CNI, passeport, permis… Orea relie ceux qui trouvent à ceux qui cherchent.
          </motion.p>

          {/* Recherche directement utilisable, en deux modes */}
          <motion.div {...rise(0.18)} className="mt-9">
            <div role="tablist" aria-label="Que veux-tu faire ?" className="grid w-full grid-cols-2 gap-1 rounded-full bg-muted p-1 sm:inline-grid sm:w-auto">
              {([
                ["lost", "Je cherche", "ma pièce", Search],
                ["found", "J'ai trouvé", "une pièce", Camera],
              ] as const).map(([value, label, more, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap transition sm:px-4",
                    mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  <span>
                    {label}
                    <span className="hidden sm:inline">&nbsp;{more}</span>
                  </span>
                </button>
              ))}
            </div>

            {mode === "lost" ? (
              <form
                onSubmit={search}
                role="search"
                className="mt-3 flex items-center gap-2 rounded-full bg-card p-1.5 pl-5 shadow-[var(--shadow-card)] ring-1 ring-border focus-within:ring-2 focus-within:ring-foreground/40"
              >
                <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <label htmlFor="hero-name" className="sr-only">Ton nom et tes prénoms</label>
                <input
                  id="hero-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ton nom et tes prénoms"
                  autoComplete="name"
                  className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/80"
                />
                <Button type="submit" className="shrink-0 px-4 sm:px-5">
                  <Search className="sm:hidden" aria-hidden />
                  <span className="sr-only sm:not-sr-only">Chercher</span>
                </Button>
              </form>
            ) : (
              <div className="mt-3">
                <Button asChild variant="highlight" size="xl">
                  <Link href="/declarer/trouve">
                    Déclarer une pièce trouvée <ArrowBadge />
                  </Link>
                </Button>
              </div>
            )}
          </motion.div>

          <motion.p {...rise(0.24)} className="mt-5 text-sm text-muted-foreground">
            {mode === "lost" ? (
              <>
                Pas encore signalée ?{" "}
                <Link href="/declarer/perdu" className="font-semibold text-foreground underline-offset-4 hover:underline">
                  Déclare ta perte
                </Link>
                , on te prévient dès qu&apos;elle refait surface.
              </>
            ) : (
              <>Une photo suffit : Orea lit la pièce et floute les données sensibles.</>
            )}
          </motion.p>

          <motion.div {...rise(0.3)} className="mt-8">
            <LiveTicker />
          </motion.div>
        </div>

        <HeroCollage />
      </div>
    </section>
  );
}
