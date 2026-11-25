"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, PartyPopper, QrCode, Sparkles, Store } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Notification, NotificationKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  match: Sparkles,
  received: Store,
  claim: QrCode,
  returned: PartyPopper,
  system: Bell,
};

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ items: Notification[]; unread: number }>("/notifications"),
    enabled,
    refetchInterval: 20_000, // assez réactif pour la démo, sans surcharger l'API
  });
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const { data } = useNotifications();
  const readAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = data?.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications : ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full border-2 border-background bg-highlight px-1 text-[11px] font-bold text-highlight-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] rounded-2xl border border-border p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-heading font-bold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => readAll.mutate()}>
              <CheckCheck /> Tout lire
            </Button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {(data?.items ?? []).length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              Rien de neuf pour l&apos;instant. On te prévient dès qu&apos;il se passe quelque chose !
            </li>
          )}
          {data?.items.slice(0, 12).map((n) => {
            const Icon = KIND_ICON[n.kind];
            const content = (
              <div className={cn("flex gap-3 px-4 py-3 transition hover:bg-muted", !n.read && "bg-glow-50 dark:bg-glow-900/20")}>
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id} className="border-b last:border-0">
                {n.link ? <Link href={n.link}>{content}</Link> : content}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
