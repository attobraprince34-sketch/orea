/** Champ de formulaire accessible : label, aide, erreur reliée par aria-describedby. */

import { AlertCircle } from "lucide-react";
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FormField({
  label,
  hint,
  error,
  children,
  className,
  review,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
  /** Champ pré-rempli par l'OCR avec peu de confiance : à vérifier. */
  review?: boolean;
  optional?: boolean;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-muted-foreground">(facultatif)</span>}
        {review && (
          <span className="rounded-full bg-glow-100 px-2 py-0.5 text-xs font-semibold text-glow-800 dark:bg-glow-900/50 dark:text-glow-200">
            À vérifier
          </span>
        )}
      </label>
      <div className={cn(review && "rounded-2xl ring-2 ring-glow-400 ring-offset-2 ring-offset-background")}>
        {control}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

/** Style commun des <select> natifs (accessibles et fiables sur mobile). */
export const selectClassName =
  "select-chevron h-12 w-full appearance-none rounded-2xl border border-input bg-card pr-10 pl-4 text-base outline-none transition hover:border-foreground/25 focus-visible:border-foreground/60 focus-visible:ring-4 focus-visible:ring-ring/25 aria-invalid:border-destructive md:text-[15px]";
