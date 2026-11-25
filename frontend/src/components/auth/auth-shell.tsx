import type { ReactNode } from "react";

import { Mascot, type MascotMood } from "@/components/brand/mascot";

/**
 * Écrans de connexion et d'inscription : formulaire épuré à gauche, panneau
 * coloré (formes du collage + Ori) à droite sur grand écran.
 */
export function AuthShell({
  title,
  subtitle,
  mood = "wave",
  children,
}: {
  title: string;
  subtitle: string;
  mood?: MascotMood;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-5 py-8 sm:px-8 lg:grid-cols-2 lg:py-12">
      <div className="flex flex-col justify-center lg:pr-12">
        <div className="mx-auto w-full max-w-md">
          <h1 className="display text-[2.6rem] sm:text-5xl">{title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{subtitle}</p>
          <div className="mt-10">{children}</div>
        </div>
      </div>

      <div aria-hidden className="relative hidden min-h-[620px] overflow-hidden rounded-[2.5rem] bg-brand-700 lg:block">
        <span className="absolute -top-10 -left-10 size-44 rounded-full bg-highlight" />
        <span className="shape-leaf-r absolute top-10 right-10 size-28 bg-[#0E1A16]" />
        <span className="shape-quarter absolute -right-4 -bottom-4 size-40 bg-glow-300" />
        <span className="absolute bottom-24 left-12 size-5 rounded-full border-[3px] border-white/70" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          <div className="grid size-80 place-items-center rounded-full bg-brand-200">
            <Mascot mood={mood} followPointer className="h-60" />
          </div>
          <p className="mt-8 font-heading text-3xl font-bold tracking-tight text-white">Content de te voir&nbsp;!</p>
          <p className="mt-2 text-[#C9E9DC]">Ori garde un œil sur tes pièces.</p>
        </div>
      </div>
    </div>
  );
}
