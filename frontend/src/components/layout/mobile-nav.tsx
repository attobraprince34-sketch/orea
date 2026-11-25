"use client";

/**
 * Barre de navigation en bas de l'écran (téléphone uniquement).
 * Les actions principales restent à portée de pouce ; le bouton central ouvre
 * le choix « J'ai trouvé / J'ai perdu ».
 */

import { Camera, Home, LayoutDashboard, LogIn, Plus, ScanLine, Search, SearchX, Store } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { homeFor, useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  // Le choix est « ouvert sur une page donnée » : il se referme tout seul
  // dès qu'on change de page, sans effet ni état à resynchroniser.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const choice = openOn === pathname;
  const setChoice = (next: boolean | ((current: boolean) => boolean)) =>
    setOpenOn((typeof next === "function" ? next(choice) : next) ? pathname : null);

  const space = user
    ? {
        href: homeFor(user),
        label: user.role === "relay" ? "Mon relais" : user.role === "admin" ? "Admin" : "Espace",
        icon: user.role === "relay" ? ScanLine : LayoutDashboard,
      }
    : { href: "/connexion", label: "Connexion", icon: LogIn };

  const items = [
    { href: "/", label: "Accueil", icon: Home },
    { href: "/recherche", label: "Chercher", icon: Search },
    null,
    { href: "/#points-relais", label: "Relais", icon: Store },
    space,
  ];

  return (
    <>
      <AnimatePresence>
        {choice && (
          <>
            <motion.button
              type="button"
              aria-label="Fermer"
              className="fixed inset-0 z-40 bg-[#0E1A16]/40 backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChoice(false)}
            />
            <motion.div
              role="dialog"
              aria-label="Que veux-tu déclarer ?"
              className="fixed inset-x-4 bottom-24 z-50 grid gap-3 lg:hidden"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <Link href="/declarer/trouve" className="flex items-center gap-4 rounded-3xl bg-highlight p-5 text-highlight-foreground shadow-xl">
                <span className="grid size-12 place-items-center rounded-full bg-[#0E1A16]/10"><Camera className="size-6" /></span>
                <span>
                  <span className="block font-heading text-lg font-bold">J&apos;ai trouvé une pièce</span>
                  <span className="text-sm opacity-80">Une photo suffit</span>
                </span>
              </Link>
              <Link href="/declarer/perdu" className="flex items-center gap-4 rounded-3xl bg-ink p-5 text-ink-foreground shadow-xl">
                <span className="grid size-12 place-items-center rounded-full bg-white/10 dark:bg-black/10"><SearchX className="size-6" /></span>
                <span>
                  <span className="block font-heading text-lg font-bold">J&apos;ai perdu une pièce</span>
                  <span className="text-sm opacity-80">On te prévient dès qu&apos;elle refait surface</span>
                </span>
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        aria-label="Navigation rapide"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          {items.map((item) =>
            item === null ? (
              <li key="declare" className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setChoice((v) => !v)}
                  aria-expanded={choice}
                  aria-label="Déclarer une pièce"
                  className="-mt-6 grid size-14 place-items-center rounded-full bg-highlight text-highlight-foreground shadow-[0_10px_24px_-8px_rgba(240,138,36,0.8)] ring-4 ring-background transition active:scale-95"
                >
                  <Plus className={cn("size-7 transition-transform", choice && "rotate-45")} />
                </button>
              </li>
            ) : (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold text-muted-foreground transition",
                    pathname === item.href && "text-foreground",
                  )}
                >
                  <item.icon className="size-[22px]" strokeWidth={pathname === item.href ? 2.4 : 1.8} />
                  {item.label}
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>
    </>
  );
}
