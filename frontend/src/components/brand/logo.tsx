/**
 * Logo Orea, reproduit fidèlement depuis la charte :
 * épingle émeraude, anneau blanc, point orange (« la pièce retrouvée, enfin à sa
 * place »), et mot-symbole « orea » en Sora.
 * Version inversée (fond sombre) : épingle blanche, anneau émeraude, point orange.
 */

import { cn } from "@/lib/utils";

/** Silhouette de l'épingle (viewBox 0 0 140 180), partagée avec la mascotte. */
export const PIN_PATH =
  "M70 0C108.66 0 140 31.34 140 70C140 104.5 109.6 134 79.6 170.6C74.6 176.7 65.4 176.7 60.4 170.6C30.4 134 0 104.5 0 70C0 31.34 31.34 0 70 0Z";

export function PinMark({
  className,
  inverted = false,
  title,
}: {
  className?: string;
  inverted?: boolean;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 140 180"
      className={cn("h-8 w-auto", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d={PIN_PATH} fill={inverted ? "#FFFFFF" : "#0F5C47"} />
      <circle cx="70" cy="70" r="34" fill={inverted ? "#0F5C47" : "#FFFFFF"} />
      <circle cx="70" cy="70" r="16" fill="#F08A24" />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label="Orea">
      {/* En mode sombre, la version inversée est utilisée automatiquement. */}
      {inverted === undefined ? (
        <>
          <PinMark className="h-[1.15em] dark:hidden" />
          <PinMark className="hidden h-[1.15em] dark:block" inverted />
        </>
      ) : (
        <PinMark className="h-[1.15em]" inverted={inverted} />
      )}
      <span
        aria-hidden
        className={cn(
          "font-heading leading-none font-extrabold tracking-[-0.04em]",
          inverted ? "text-white" : "text-[#0E1A16] dark:text-white",
        )}
      >
        orea
      </span>
    </span>
  );
}
