"use client";

/**
 * Centre de contrôle (vue d'ensemble de l'administrateur).
 * Panneau sombre « salle de pilotage » : anneau de réussite, indicateurs avec
 * mini-courbes, carte thermique d'Abidjan, flux d'activité en direct, entonnoir.
 * La classe `dark` force la palette sombre dans tout le panneau, quel que soit
 * le thème choisi par l'utilisateur.
 */

import { useQuery } from "@tanstack/react-query";
import {
  CheckCheck,
  FileClock,
  Handshake,
  KeyRound,
  PackageCheck,
  ScanLine,
  ShieldAlert,
  Sparkles,
  Store,
  UserCog,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { AnimatedCounter } from "@/components/common/motion";
import { ErrorState, LoadingState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { AdminStats, AuditEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActivityChart, RankingChart } from "./charts";

const HeatMap = dynamic(() => import("./heat-map-inner"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none bg-white/5" />,
});

/* --------------------------------------------------------------------------- */
function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return now;
}

/** Mini-courbe sans axes (tendance des 30 derniers jours). */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const w = 120;
  const h = 36;
  const points = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * w},${h - (v / max) * (h - 4) - 2}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-28" aria-hidden>
      <polyline points={`0,${h} ${points.join(" ")} ${w},${h}`} fill={color} opacity={0.15} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Grand anneau animé du taux de réussite. */
function SuccessRing({ value }: { value: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto size-48">
      <svg viewBox="0 0 180 180" className="size-full -rotate-90" aria-hidden>
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="16" />
        <motion.circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <defs>
          <linearGradient id="ring" x1="0" x2="1">
            <stop offset="0%" stopColor="#8CD2B8" />
            <stop offset="100%" stopColor="#F08A24" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-heading text-5xl font-extrabold tracking-tight">
            <AnimatedCounter value={value} suffix="%" />
          </p>
          <p className="text-sm text-white/60">de pièces rendues</p>
        </div>
      </div>
    </div>
  );
}

const ACTIONS: Record<string, { label: string; icon: typeof Store; tone: string }> = {
  "found.created": { label: "Pièce trouvée signalée", icon: ScanLine, tone: "text-brand-300" },
  "lost.created": { label: "Perte déclarée", icon: FileClock, tone: "text-white/70" },
  "found.received": { label: "Pièce réceptionnée au relais", icon: Store, tone: "text-brand-300" },
  "claim.verified": { label: "Propriétaire vérifié, QR émis", icon: KeyRound, tone: "text-glow-400" },
  "claim.failed": { label: "Numéro erroné", icon: ShieldAlert, tone: "text-red-400" },
  "pickup.scanned": { label: "QR scanné au relais", icon: ScanLine, tone: "text-white/70" },
  "pickup.completed": { label: "Pièce rendue à son propriétaire", icon: CheckCheck, tone: "text-[#2fd196]" },
  "declaration.moderated": { label: "Déclaration modérée", icon: ShieldAlert, tone: "text-white/70" },
  "user.updated": { label: "Utilisateur modifié", icon: UserCog, tone: "text-white/70" },
};

function LiveFeed() {
  const { data } = useQuery({
    queryKey: ["admin-audit-live"],
    queryFn: () => api<AuditEntry[]>("/admin/audit", { query: { limit: 14 } }),
    refetchInterval: 4000,
  });
  return (
    <ul className="space-y-1" aria-live="polite">
      <AnimatePresence initial={false}>
        {(data ?? []).map((entry) => {
          const meta = ACTIONS[entry.action] ?? { label: entry.action, icon: Sparkles, tone: "text-white/70" };
          const Icon = meta.icon;
          return (
            <motion.li
              key={entry.id}
              layout
              initial={{ opacity: 0, x: -16, backgroundColor: "rgba(240,138,36,0.25)" }}
              animate={{ opacity: 1, x: 0, backgroundColor: "rgba(255,255,255,0)" }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06]", meta.tone)}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{meta.label}</span>
              <span className="shrink-0 text-xs text-white/40">{timeAgo(entry.created_at)}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function Panel({ className, title, children, right }: { className?: string; title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col rounded-[1.75rem] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6", className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold tracking-wide text-white/70 uppercase">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function CommandCenter() {
  const now = useClock();
  const query = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api<AdminStats>("/admin/stats"),
    refetchInterval: 15000,
  });
  if (query.isPending) return <LoadingState label="Mise en route du centre de contrôle…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const s = query.data;

  const status = Object.fromEntries(s.by_status.map((x) => [x.key, x.count]));
  const funnel = [
    { label: "Pièces signalées", value: s.documents_found, icon: ScanLine },
    { label: "Correspondance trouvée", value: (status.matched ?? 0) + (status.claimed ?? 0) + (status.returned ?? 0), icon: Sparkles },
    { label: "Propriétaire vérifié", value: (status.claimed ?? 0) + (status.returned ?? 0), icon: Handshake },
    { label: "Pièce rendue", value: status.returned ?? 0, icon: PackageCheck },
  ];
  const tiles = [
    { label: "Pièces signalées", value: s.documents_found, series: s.timeline.map((d) => d.found), color: "#8CD2B8" },
    { label: "Pertes déclarées", value: s.lost_reports, series: s.timeline.map((d) => d.lost), color: "#B5E8D4" },
    { label: "Pièces rendues", value: s.documents_returned, series: s.timeline.map((d) => d.returned), color: "#F08A24" },
    { label: "En attente aux relais", value: s.pending_at_relays, series: s.timeline.map((d) => d.found - d.returned), color: "#FFA151" },
  ];

  return (
    <div className="dark">
      <div className="overflow-hidden rounded-[2.25rem] bg-[#0B1512] p-4 text-white sm:p-6 lg:p-8">
        {/* En-tête */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#2fd196]">
              <span className="live-dot" /> En direct
            </p>
            <h2 className="display mt-2 text-3xl sm:text-4xl">Centre de contrôle</h2>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold tabular text-white/90" suppressHydrationWarning>
              {now ? now.toLocaleTimeString("fr-CI") : "--:--:--"}
            </p>
            <p className="text-sm text-white/50" suppressHydrationWarning>
              {now ? now.toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long" }) : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Anneau de réussite */}
          <Panel className="lg:col-span-4" title="Taux de réussite">
            <SuccessRing value={Math.round(s.success_rate)} />
            <div className="mt-5 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-white/[0.04] p-3">
                <p className="font-heading text-2xl font-bold">
                  {s.average_days_to_return !== null ? <AnimatedCounter value={s.average_days_to_return} decimals={1} suffix=" j" /> : "—"}
                </p>
                <p className="text-xs text-white/50">délai moyen de retour</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3">
                <p className="font-heading text-2xl font-bold"><AnimatedCounter value={s.matches} /></p>
                <p className="text-xs text-white/50">correspondances</p>
              </div>
            </div>
          </Panel>

          {/* Indicateurs avec mini-courbes */}
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:col-span-8">
            {tiles.map((t) => (
              <Panel key={t.label} className="flex flex-col justify-between">
                <p className="text-sm text-white/60">{t.label}</p>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
                  <p className="font-heading text-3xl font-extrabold tracking-tight sm:text-5xl">
                    <AnimatedCounter value={t.value} />
                  </p>
                  <Sparkline values={t.series.map((v) => Math.max(v, 0))} color={t.color} />
                </div>
              </Panel>
            ))}
          </div>

          {/* Carte thermique */}
          <Panel className="p-0 sm:p-0 lg:col-span-8" >
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <h3 className="text-sm font-semibold tracking-wide text-white/70 uppercase">Carte thermique · Abidjan</h3>
              <span className="hidden text-xs text-white/40 sm:inline">Lieux où les pièces sont trouvées</span>
            </div>
            <div className="mt-4 h-[360px] overflow-hidden rounded-b-[1.75rem] sm:h-[420px]">
              <HeatMap data={s.by_commune} />
            </div>
          </Panel>

          {/* Flux d'activité */}
          <Panel className="lg:col-span-4" title="Activité" right={<span className="live-dot" aria-label="en direct" />}>
            <div className="max-h-[400px] overflow-y-auto pr-1">
              <LiveFeed />
            </div>
          </Panel>

          {/* Entonnoir */}
          <Panel className="lg:col-span-5" title="Du signalement à la restitution">
            <ol className="mb-6 space-y-3">
              {funnel.map((step, index) => {
                const pct = s.documents_found ? (step.value / s.documents_found) * 100 : 0;
                const Icon = step.icon;
                return (
                  <li key={step.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-white/80"><Icon className="size-4 text-glow-400" /> {step.label}</span>
                      <span className="font-semibold tabular">{step.value} <span className="text-white/40">· {Math.round(pct)} %</span></span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: index === funnel.length - 1 ? "#F08A24" : "#8CD2B8" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, 2)}%` }}
                        transition={{ duration: 1.2, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-auto flex items-center gap-4 rounded-2xl bg-highlight p-4 text-[#0E1A16]">
              <Store className="size-8 shrink-0" />
              <p className="text-sm font-medium">
                <strong className="font-heading text-xl">{s.pending_at_relays} pièces</strong> attendent leur propriétaire
                dans les points relais en ce moment.
              </p>
            </div>
          </Panel>

          <div className="lg:col-span-7">
            <ActivityChart timeline={s.timeline} />
          </div>
          <div className="lg:col-span-6"><RankingChart title="Communes les plus concernées" subtitle="Lieu où les pièces ont été trouvées" data={s.by_commune} /></div>
          <div className="lg:col-span-6"><RankingChart title="Types de pièces" subtitle="Pièces signalées par type" data={s.by_doc_type} /></div>
        </div>
      </div>
    </div>
  );
}
