"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Image as ImageIcon, PackageCheck, PackageOpen, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Mascot } from "@/components/brand/mascot";
import { PageTransition } from "@/components/common/motion";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback/states";
import { RequireAuth } from "@/components/providers/require-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { celebrate } from "@/lib/confetti";
import { formatDate, formatDateTime } from "@/lib/format";
import type { FoundDocument, PickupPreview, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QrScannerPanel } from "./qr-scanner-panel";

type Filter = "awaiting" | "stock" | "all";

export function RelaySpace() {
  return <RequireAuth roles={["relay", "admin"]}>{(user) => <RelayInner user={user} />}</RequireAuth>;
}

function RelayInner({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("awaiting");
  const [preview, setPreview] = useState<{ code: string; data: PickupPreview } | null>(null);
  const [returned, setReturned] = useState<PickupPreview | null>(null);
  const [photoFor, setPhotoFor] = useState<FoundDocument | null>(null);

  const documents = useQuery({
    queryKey: ["relay-documents"],
    queryFn: () => api<FoundDocument[]>("/relay/documents"),
    enabled: Boolean(user.relay_point),
    refetchInterval: 30_000,
  });

  const receive = useMutation({
    mutationFn: (id: string) => api<FoundDocument>(`/relay/documents/${id}/receive`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Réception confirmée. Le trouveur et le propriétaire sont prévenus.");
      queryClient.invalidateQueries({ queryKey: ["relay-documents"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const verify = useMutation({
    mutationFn: (code: string) => api<PickupPreview>("/relay/pickup/verify", { method: "POST", body: { code } }),
    onSuccess: (data, code) => setPreview({ code, data }),
    onError: (e) => toast.error(errorMessage(e), { duration: 6000 }),
  });

  const confirm = useMutation({
    mutationFn: (code: string) => api("/relay/pickup/confirm", { method: "POST", body: { code } }),
    onSuccess: () => {
      setReturned(preview?.data ?? null);
      setPreview(null);
      celebrate();
      queryClient.invalidateQueries({ queryKey: ["relay-documents"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const docs = useMemo(() => documents.data ?? [], [documents.data]);
  const stats = {
    awaiting: docs.filter((d) => !d.received_at && ["pending", "matched", "claimed"].includes(d.status)).length,
    stock: docs.filter((d) => d.received_at && ["pending", "matched", "claimed"].includes(d.status)).length,
    claimed: docs.filter((d) => d.status === "claimed").length,
    returned: docs.filter((d) => d.status === "returned").length,
  };
  const visible = docs.filter((d) =>
    filter === "awaiting"
      ? !d.received_at && ["pending", "matched", "claimed"].includes(d.status)
      : filter === "stock"
        ? d.received_at && ["pending", "matched", "claimed"].includes(d.status)
        : true,
  );

  if (!user.relay_point) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <EmptyState title="Aucun point relais rattaché" description="Demande à l'administrateur de rattacher ton compte à un point relais." />
      </div>
    );
  }

  return (
    <PageTransition className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <p className="eyebrow">Espace point relais · {user.relay_point.name.split(" · ")[0]}</p>
      {/* « Relais Orea · Cocody Deux-Plateaux » → titre court : « Cocody Deux-Plateaux » */}
      <h1 className="display mt-3 text-[2.4rem] sm:text-6xl">
        {user.relay_point.name.split(" · ").at(-1)}
      </h1>
      <p className="mt-2 text-muted-foreground">{user.relay_point.address} · {user.relay_point.commune_label}</p>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "À réceptionner", value: stats.awaiting, highlight: stats.awaiting > 0 },
          { label: "En stock", value: stats.stock },
          { label: "Réclamées (QR actif)", value: stats.claimed },
          { label: "Restituées", value: stats.returned },
        ].map((kpi) => (
          <div key={kpi.label} className={cn("surface p-4 sm:p-5", kpi.highlight ? "bg-highlight text-highlight-foreground" : "bg-card")}>
            {documents.isPending ? <Skeleton className="h-10 w-12" /> : <p className="font-heading text-4xl font-extrabold tabular">{kpi.value}</p>}
            <p className={cn("mt-1 text-sm font-semibold", !kpi.highlight && "text-muted-foreground")}>{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <QrScannerPanel onCode={(code) => !verify.isPending && verify.mutate(code)} busy={verify.isPending} />
          {returned && (
            <div className="surface bg-brand-100 p-5 text-center dark:bg-brand-900/50" role="status">
              <Mascot mood="party" className="mx-auto h-24" />
              <p className="mt-2 font-heading text-lg font-bold">Pièce restituée à {returned.claimant_name} !</p>
              <p className="text-sm text-muted-foreground">Bravo, une bonne action de plus.</p>
            </div>
          )}
        </div>

        <section aria-labelledby="docs-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="docs-title" className="text-2xl font-bold">Pièces de ton point relais</h2>
            <div role="tablist" aria-label="Filtrer" className="flex gap-1 rounded-full border border-border bg-card p-1">
              {([["awaiting", "À réceptionner"], ["stock", "En stock"], ["all", "Toutes"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn("rounded-full px-3 py-1.5 text-sm font-semibold transition", filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {documents.isPending && <LoadingState />}
            {documents.isError && <ErrorState error={documents.error} onRetry={() => documents.refetch()} />}
            {documents.data && visible.length === 0 && (
              <EmptyState
                title={filter === "awaiting" ? "Rien à réceptionner" : "Aucune pièce ici"}
                description={filter === "awaiting" ? "Toutes les pièces annoncées sont déjà arrivées." : "Les pièces déposées chez toi apparaîtront ici."}
              />
            )}
            <ul className="space-y-3">
              {visible.map((doc) => (
                <li key={doc.id} className="surface flex flex-col gap-4 bg-card p-5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">{doc.doc_type_label}</span>
                      <StatusBadge status={doc.status} />
                    </div>
                    <p className="mt-2 font-heading text-lg font-bold">{doc.holder_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Trouvée le {formatDate(doc.found_on)} · {doc.received_at ? `reçue ${formatDateTime(doc.received_at)}` : "pas encore déposée"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {doc.has_photo && (
                      <Button variant="ghost" size="sm" onClick={() => setPhotoFor(doc)}><ImageIcon /> Photo floutée</Button>
                    )}
                    {!doc.received_at && ["pending", "matched", "claimed"].includes(doc.status) && (
                      <Button size="sm" onClick={() => receive.mutate(doc.id)} disabled={receive.isPending}>
                        <PackageCheck /> Confirmer la réception
                      </Button>
                    )}
                    {doc.received_at && doc.status !== "returned" && (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-primary"><PackageOpen className="size-4" /> En stock</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Aperçu avant remise : l'agent vérifie l'identité avant de consommer le QR. */}
      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="rounded-3xl border border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl"><CheckCircle2 className="size-6 text-primary" /> QR code valide</DialogTitle>
            <DialogDescription>Vérifie l&apos;identité du demandeur avant de remettre la pièce.</DialogDescription>
          </DialogHeader>
          {preview && (
            <dl className="space-y-3 rounded-2xl bg-muted p-4 text-sm">
              <div><dt className="text-muted-foreground">Pièce</dt><dd className="font-semibold">{preview.data.doc_type_label} · {preview.data.holder_name}</dd></div>
              <div><dt className="text-muted-foreground">Demandeur</dt><dd className="flex items-center gap-1.5 font-semibold"><UserRound className="size-4" /> {preview.data.claimant_name}</dd></div>
              {preview.data.claimant_phone && (
                <div><dt className="text-muted-foreground">Téléphone</dt><dd className="flex items-center gap-1.5 font-semibold"><Phone className="size-4" /> {preview.data.claimant_phone}</dd></div>
              )}
            </dl>
          )}
          <p className="flex gap-2 rounded-2xl border border-glow-300 bg-glow-50 p-3 text-sm text-glow-900 dark:bg-glow-900/30 dark:text-glow-100">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Le visage du demandeur doit correspondre à la photo de la pièce. Le QR ne servira qu&apos;une fois.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPreview(null)}><AlertTriangle /> Ne pas remettre</Button>
            <Button variant="highlight" onClick={() => preview && confirm.mutate(preview.code)} disabled={confirm.isPending}>
              <PackageCheck /> {confirm.isPending ? "Validation…" : "Remettre la pièce"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PhotoDialog document={photoFor} onClose={() => setPhotoFor(null)} />
    </PageTransition>
  );
}

function PhotoDialog({ document, onClose }: { document: FoundDocument | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["found-photo", document?.id],
    queryFn: () => api<Blob>(`/found/${document?.id}/photo`),
    enabled: Boolean(document),
    staleTime: Infinity,
  });
  const url = useMemo(() => (query.data ? URL.createObjectURL(query.data) : null), [query.data]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  return (
    <Dialog open={Boolean(document)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl border border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Photo floutée</DialogTitle>
          <DialogDescription>Pour reconnaître la pièce physique. Les données sensibles sont masquées.</DialogDescription>
        </DialogHeader>
        {query.isPending ? <Skeleton className="aspect-[1.6] w-full rounded-2xl" /> : url ? (
          // eslint-disable-next-line @next/next/no-img-element -- image protégée chargée en blob
          <img src={url} alt="Photo floutée de la pièce" className="w-full rounded-2xl border border-border" />
        ) : (
          <p className="text-sm text-muted-foreground">Photo indisponible.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
