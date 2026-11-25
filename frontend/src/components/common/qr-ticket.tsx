"use client";

/** Billet de retrait : QR code + code de secours + informations du point relais. */

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock, MapPin, Store } from "lucide-react";
import { useEffect, useMemo } from "react";

import { PinMark } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { daysLeft, formatDate } from "@/lib/format";
import type { Claim } from "@/lib/types";
import { cn } from "@/lib/utils";

function useQrImage(claimId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ["qr", claimId],
    // L'image est protégée : on la télécharge avec le jeton, puis on l'affiche localement.
    queryFn: () => api<Blob>(`/claims/${claimId}/qr.png`),
    enabled,
    staleTime: Infinity,
  });
  const url = useMemo(() => (query.data ? URL.createObjectURL(query.data) : null), [query.data]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return { url, isPending: query.isPending && enabled };
}

export function QrTicket({ claim, className }: { claim: Claim; className?: string }) {
  const active = claim.status === "active" && claim.pickup;
  const { url, isPending } = useQrImage(claim.id, Boolean(active));
  const left = claim.pickup ? daysLeft(claim.pickup.expires_at) : 0;

  return (
    <article className={cn("surface relative overflow-hidden bg-card", className)}>
      {/* En-tête du billet */}
      <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground dark:bg-brand-800 dark:text-white">
        <div className="flex items-center gap-2">
          <PinMark inverted className="h-6" />
          <span className="font-heading font-bold">Billet de retrait</span>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">{claim.doc_type_label}</span>
      </div>

      <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="mx-auto grid size-52 place-items-center rounded-2xl border border-border bg-white p-2">
          {claim.status === "completed" ? (
            <div className="text-center text-[#0F5C47]">
              <CheckCircle2 className="mx-auto size-14" />
              <p className="mt-2 font-heading font-bold">Pièce récupérée</p>
            </div>
          ) : !active ? (
            <p className="px-4 text-center text-sm font-semibold text-[#4A6058]">QR code expiré. Tu peux refaire une réclamation.</p>
          ) : isPending || !url ? (
            <Skeleton className="size-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- image générée localement (blob)
            <img src={url} alt={`QR code de retrait pour ${claim.doc_type_label}`} className="size-full" />
          )}
        </div>

        <div className="space-y-3">
          {active && claim.pickup && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Code de secours (si le scan échoue)</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest">{claim.pickup.short_code}</p>
            </div>
          )}
          <p className="flex items-start gap-2 text-sm">
            <Store className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <strong>{claim.relay_point.name}</strong>
              <br />
              <span className="text-muted-foreground">
                <MapPin className="mr-1 inline size-3" />
                {claim.relay_point.address}, {claim.relay_point.commune_label}
              </span>
            </span>
          </p>
          {active && claim.pickup && (
            <p className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4 text-primary" />
              Valable jusqu&apos;au {formatDate(claim.pickup.expires_at)}
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", left <= 3 ? "bg-glow-100 text-glow-800" : "bg-secondary")}>
                J-{left}
              </span>
            </p>
          )}
          {active && !claim.received_by_relay && (
            <p className="flex items-center gap-2 rounded-xl bg-glow-50 px-3 py-2 text-sm text-glow-800 dark:bg-glow-900/30 dark:text-glow-200">
              <Clock className="size-4 shrink-0" />
              La pièce est en route vers le point relais. On te prévient dès son arrivée.
            </p>
          )}
          {active && (
            <p className="text-xs text-muted-foreground">
              Présente ce QR et une pièce justificative à l&apos;agent. Il ne fonctionne qu&apos;une seule fois.
            </p>
          )}
        </div>
      </div>

      {/* Encoches du billet */}
      <span className="absolute top-[60px] -left-3 size-6 rounded-full border border-border bg-background" aria-hidden />
      <span className="absolute top-[60px] -right-3 size-6 rounded-full border border-border bg-background" aria-hidden />
    </article>
  );
}
