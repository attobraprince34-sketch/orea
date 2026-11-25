"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Phone } from "lucide-react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { RelayPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const RelayMapInner = dynamic(() => import("@/components/map/relay-map-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export function useRelayPoints() {
  return useQuery({
    queryKey: ["relay-points"],
    queryFn: () => api<RelayPoint[]>("/relay-points"),
    staleTime: 5 * 60_000,
  });
}

/**
 * Carte + liste des points relais. La liste double la carte pour la navigation
 * au clavier et les lecteurs d'écran (une carte seule n'est pas accessible).
 */
export function RelayMap({
  selectedId,
  onSelect,
  className,
  mapClassName,
}: {
  selectedId?: string;
  onSelect?: (point: RelayPoint) => void;
  className?: string;
  mapClassName?: string;
}) {
  const { data: points = [], isPending } = useRelayPoints();

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[1.6fr_1fr]", className)}>
      <div className={cn("surface relative h-80 overflow-hidden bg-muted sm:h-[420px]", mapClassName)}>
        {isPending ? <Skeleton className="h-full w-full rounded-none" /> : (
          <RelayMapInner points={points} selectedId={selectedId} onSelect={onSelect} />
        )}
      </div>
      <ul className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1" aria-label="Liste des points relais">
        {isPending &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        {points.map((point) => {
          const active = point.id === selectedId;
          const Wrapper = onSelect ? "button" : "div";
          return (
            <li key={point.id}>
              <Wrapper
                type={onSelect ? "button" : undefined}
                onClick={onSelect ? () => onSelect(point) : undefined}
                aria-pressed={onSelect ? active : undefined}
                className={cn(
                  "w-full rounded-3xl border bg-card p-4 text-left transition",
                  onSelect && "hover:border-foreground/30",
                  active ? "border-highlight bg-glow-50 ring-2 ring-highlight dark:bg-glow-900/20" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{point.name}</p>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                    {point.commune_label}
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" aria-hidden /> {point.address}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" aria-hidden /> {point.opening_hours}
                </p>
                {point.phone && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" aria-hidden /> {point.phone}
                  </p>
                )}
              </Wrapper>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
