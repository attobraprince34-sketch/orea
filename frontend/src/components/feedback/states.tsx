"use client";

/** États vides, d'erreur et de chargement, illustrés par Ori. */

import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Mascot } from "@/components/brand/mascot";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-3xl border-2 border-dashed border-border bg-card/60 px-6 py-10 text-center",
        className,
      )}
    >
      <Mascot mood="empty" className="h-32" />
      <h3 className="mt-4 text-xl font-bold">{title}</h3>
      {description && <p className="mt-2 max-w-md text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-3xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <Mascot mood="oops" className="h-32" />
      <h3 className="mt-4 text-xl font-bold">Oups, ça n&apos;a pas marché</h3>
      <p className="mt-2 max-w-md text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          <RefreshCw /> Réessayer
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Ori cherche…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center py-12 text-center", className)} role="status">
      <Mascot mood="search" className="h-28" label={label} />
      <p className="mt-3 font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
