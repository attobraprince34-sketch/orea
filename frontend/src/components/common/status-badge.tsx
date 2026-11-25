import { CheckCheck, CircleDashed, Clock, Handshake, Sparkles, XCircle } from "lucide-react";

import { STATUS_STYLE } from "@/lib/constants";
import type { DeclarationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = {
  pending: Clock,
  matched: Sparkles,
  claimed: Handshake,
  returned: CheckCheck,
  expired: CircleDashed,
  cancelled: XCircle,
} satisfies Record<DeclarationStatus, unknown>;

/** Badge de statut : couleur + icône + texte (jamais la couleur seule). */
export function StatusBadge({ status, className }: { status: DeclarationStatus; className?: string }) {
  const Icon = ICONS[status];
  const style = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        style.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {style.label}
    </span>
  );
}
