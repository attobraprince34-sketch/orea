"use client";

/**
 * Alerte « en direct », en plein écran.
 *
 * Toutes les 5 secondes, l'application vérifie les notifications de l'utilisateur.
 * Dès qu'une NOUVELLE bonne nouvelle arrive (correspondance, QR prêt, pièce rendue),
 * l'écran s'illumine : confettis, Ori qui saute, et un bouton pour agir tout de suite.
 * Pendant la démo : Koffi déclare la pièce… et l'écran d'Aya réagit tout seul.
 */

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Mascot } from "@/components/brand/mascot";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/confetti";
import type { Notification } from "@/lib/types";

const BIG_NEWS = new Set(["match", "claim", "returned"]);

export function LiveAlert() {
  const { status } = useAuth();
  const seen = useRef<Set<string> | null>(null);
  const [alert, setAlert] = useState<Notification | null>(null);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ items: Notification[]; unread: number }>("/notifications"),
    enabled: status === "authenticated",
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // On réinitialise la mémoire à chaque changement de compte.
  useEffect(() => {
    if (status !== "authenticated") seen.current = null;
  }, [status]);

  useEffect(() => {
    if (!data) return;
    // Premier chargement : on mémorise l'existant sans rien afficher.
    if (seen.current === null) {
      seen.current = new Set(data.items.map((n) => n.id));
      return;
    }
    const fresh = data.items.filter((n) => !n.read && !seen.current!.has(n.id));
    fresh.forEach((n) => seen.current!.add(n.id));
    const big = fresh.find((n) => BIG_NEWS.has(n.kind));
    if (big) {
      setAlert(big);
      celebrate();
    } else if (fresh[0]) {
      toast(fresh[0].title, { description: fresh[0].body });
    }
  }, [data]);

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#0E1A16]/70 p-5 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setAlert(null)}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="live-alert-title"
            className="relative w-full max-w-md overflow-hidden rounded-[2.25rem] bg-highlight p-8 text-center text-[#0E1A16] shadow-2xl"
            initial={{ scale: 0.7, y: 40, rotate: -4 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ondes autour d'Ori */}
            {[0, 0.6, 1.2].map((delay) => (
              <motion.span
                key={delay}
                aria-hidden
                className="absolute top-24 left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70"
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, delay }}
              />
            ))}
            <button
              type="button"
              onClick={() => setAlert(null)}
              aria-label="Fermer"
              className="absolute top-4 right-4 z-10 grid size-10 place-items-center rounded-full bg-[#0E1A16]/10 transition hover:bg-[#0E1A16]/20"
            >
              <X className="size-5" />
            </button>
            <p className="relative text-xs font-bold tracking-[0.2em] uppercase">En direct</p>
            <Mascot mood="party" className="relative mx-auto mt-2 h-40" />
            <h2 id="live-alert-title" className="display relative mt-4 text-3xl">
              {alert.title}
            </h2>
            <p className="relative mt-3 text-[#0E1A16]/80">{alert.body}</p>
            {alert.link && (
              <Button asChild size="lg" className="relative mt-7 w-full" onClick={() => setAlert(null)}>
                <Link href={alert.link}>
                  {alert.kind === "match" ? "Récupérer ma pièce" : "Voir"} <ArrowRight />
                </Link>
              </Button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
