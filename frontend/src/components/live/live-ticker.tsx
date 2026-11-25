"use client";

/**
 * Fil « en direct » : les derniers événements réels, totalement anonymes
 * (type de pièce + commune), qui défilent un par un. Le site respire.
 */

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { atCommune } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const FEMININE = new Set(["cni", "carte_etudiant", "carte_grise", "attestation"]);

function sentence(item: ActivityItem): { emoji: string; text: string } {
  const doc = item.doc_type === "cni" ? "une CNI" : `${FEMININE.has(item.doc_type) ? "une" : "un"} ${item.doc_type_label.toLowerCase()}`;
  const where = atCommune(item.commune, item.commune_label);
  const e = FEMININE.has(item.doc_type) ? "e" : "";
  if (item.kind === "returned") return { emoji: "rendue", text: `${upper(doc)} rendu${e} à son propriétaire ${where}` };
  if (item.kind === "match") return { emoji: "match", text: `Correspondance trouvée pour ${doc} ${where}` };
  return { emoji: "found", text: `${upper(doc)} signalé${e} ${where}` };
}

const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const DOT: Record<string, string> = {
  rendue: "bg-[#2fd196]",
  match: "bg-highlight",
  found: "bg-brand-400",
};

export function LiveTicker({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ["activity"],
    queryFn: () => api<ActivityItem[]>("/stats/activity", { query: { limit: 10 } }),
    refetchInterval: 15000,
  });
  const [index, setIndex] = useState(0);
  const items = data ?? [];

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 3800);
    return () => clearInterval(id);
  }, [items.length]);

  const current = items[index % Math.max(items.length, 1)];
  if (!current) return null;
  const { emoji, text } = sentence(current);

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-3 overflow-hidden rounded-full bg-card py-2 pr-4 pl-2 text-sm shadow-[var(--shadow-card)] ring-1 ring-border",
        className,
      )}
      aria-live="polite"
    >
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#0E1A16] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase dark:bg-white/10">
        <span className="live-dot" /> En direct
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={`${current.kind}-${current.at}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex min-w-0 items-center gap-2"
        >
          <span className={cn("size-2 shrink-0 rounded-full", DOT[emoji])} aria-hidden />
          <span className="truncate font-medium">{text}</span>
          <span className="shrink-0 text-muted-foreground">· {timeAgo(current.at)}</span>
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
