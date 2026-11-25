"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  Search,
  Sparkles,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageTransition } from "@/components/common/motion";
import { QrTicket } from "@/components/common/qr-ticket";
import { StatusBadge } from "@/components/common/status-badge";
import { FormField } from "@/components/common/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback/states";
import { MatchExplainer } from "@/components/live/match-explainer";
import { SharePoster } from "@/components/live/share-poster";
import { useNotifications } from "@/components/layout/notification-bell";
import { useAuth } from "@/components/providers/auth-provider";
import { RequireAuth } from "@/components/providers/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";
import type { Claim, FoundDocument, LostReport, User } from "@/lib/types";

const TABS = [
  { value: "pertes", label: "Mes pertes", icon: Search },
  { value: "trouvailles", label: "Mes trouvailles", icon: Camera },
  { value: "qr", label: "Mes QR codes", icon: QrCode },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "profil", label: "Profil", icon: UserRound },
];

export function Dashboard() {
  return <RequireAuth>{(user) => <DashboardInner user={user} />}</RequireAuth>;
}

function DashboardInner({ user }: { user: User }) {
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get("onglet") ?? "pertes";
  const notifications = useNotifications();

  return (
    <PageTransition className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Mon espace</p>
          <h1 className="display mt-3 text-[2.6rem] sm:text-6xl">Salut {user.full_name.split(" ")[0]} !</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/declarer/perdu"><Search /> J&apos;ai perdu</Link></Button>
          <Button asChild variant="highlight"><Link href="/declarer/trouve"><Camera /> J&apos;ai trouvé</Link></Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => router.replace(`${pathname}?onglet=${value}`, { scroll: false })} className="mt-10">
        <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto rounded-full bg-muted p-1 sm:w-fit">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-10 flex-none gap-2 rounded-full px-4 text-muted-foreground data-[state=active]:bg-ink data-[state=active]:text-ink-foreground data-[state=active]:shadow-none"
            >
              <Icon className="size-4" /> {label}
              {value === "notifications" && (notifications.data?.unread ?? 0) > 0 && (
                <span className="rounded-full bg-highlight px-1.5 text-xs font-bold text-highlight-foreground">{notifications.data?.unread}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="pertes" className="mt-6"><LostTab /></TabsContent>
        <TabsContent value="trouvailles" className="mt-6"><FoundTab /></TabsContent>
        <TabsContent value="qr" className="mt-6"><ClaimsTab /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><NotificationsTab /></TabsContent>
        <TabsContent value="profil" className="mt-6"><ProfileTab user={user} /></TabsContent>
      </Tabs>
    </PageTransition>
  );
}

/* --------------------------------------------------------------------------- */
function LostTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["lost"], queryFn: () => api<LostReport[]>("/lost/mine") });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/lost/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Déclaration clôturée. Content que ça se soit arrangé !");
      queryClient.invalidateQueries({ queryKey: ["lost"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data.length)
    return (
      <EmptyState
        title="Aucune perte déclarée"
        description="Tu as perdu une pièce ? Déclare-la : Orea te prévient dès qu'elle est retrouvée."
        action={<Button asChild variant="highlight"><Link href="/declarer/perdu">Déclarer une perte</Link></Button>}
      />
    );

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {query.data.map((lost) => (
        <li key={lost.id} className="surface flex flex-col bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{lost.doc_type_label}</p>
              <p className="font-heading text-xl font-bold">{lost.holder_name}</p>
            </div>
            <StatusBadge status={lost.status} />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" /> Déclarée le {formatDate(lost.created_at)}
          </p>

          {lost.matches.length > 0 ? (
            <div className="mt-4 space-y-2">
              {lost.matches.map((match) => (
                <div key={match.match_id} className="rounded-2xl border border-glow-300 bg-glow-50 p-4 dark:bg-glow-900/20">
                  <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-glow-600" /> Pièce correspondante trouvée</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm"><Store className="size-4" /> {match.relay_point.name}, {match.relay_point.commune_label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {match.received_by_relay ? "Déjà au point relais" : "En route vers le point relais"}
                  </p>
                  <MatchExplainer score={match.score} reasons={match.reasons} className="mt-4 rounded-2xl bg-card/70 p-3" />
                  {(lost.status === "matched" || lost.status === "pending") && (match.status === "matched" || match.status === "pending") && (
                    <Button asChild size="sm" variant="highlight" className="mt-3">
                      <Link href={`/reclamer/${match.found_document_id}`}>C&apos;est la mienne <ArrowRight /></Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            lost.status === "pending" && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm">
                <Clock className="size-4 text-primary" /> Ori garde l&apos;œil ouvert. On te prévient dès qu&apos;elle refait surface.
              </p>
            )
          )}

          {(lost.status === "pending" || lost.status === "matched") && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {lost.status === "pending" && <SharePoster lost={lost} />}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => cancel.mutate(lost.id)}
                disabled={cancel.isPending}
              >
                <Trash2 /> Je l&apos;ai retrouvée autrement
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------------------- */
function FoundTab() {
  const query = useQuery({ queryKey: ["found"], queryFn: () => api<FoundDocument[]>("/found/mine") });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data.length)
    return (
      <EmptyState
        title="Aucune trouvaille pour l'instant"
        description="Si un jour tu trouves une pièce, une photo suffit pour aider son propriétaire."
        action={<Button asChild variant="highlight"><Link href="/declarer/trouve">Déclarer une pièce trouvée</Link></Button>}
      />
    );
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {query.data.map((found) => (
        <li key={found.id} className="surface bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{found.doc_type_label}</p>
              <p className="font-heading text-xl font-bold">{found.holder_initials}</p>
            </div>
            <StatusBadge status={found.status} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm"><MapPin className="size-4 text-primary" /> {found.relay_point.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            {found.received_at ? (
              <><CheckCircle2 className="size-4 text-primary" /> Dépôt confirmé le {formatDate(found.received_at)}</>
            ) : (
              <><Clock className="size-4" /> En attente de dépôt au point relais</>
            )}
          </p>
          {found.status === "returned" && (
            <p className="mt-3 rounded-2xl bg-brand-100 px-4 py-3 text-sm font-semibold text-brand-800 dark:bg-brand-900/60 dark:text-brand-100">
              Rendue à son propriétaire. Merci, tu as fait sa journée !
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------------------- */
function ClaimsTab() {
  const query = useQuery({ queryKey: ["claims"], queryFn: () => api<Claim[]>("/claims/mine") });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data.length)
    return (
      <EmptyState
        title="Aucun QR code"
        description="Quand tu réclames une pièce, ton QR code de retrait apparaît ici."
        action={<Button asChild variant="outline"><Link href="/recherche">Chercher ma pièce</Link></Button>}
      />
    );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {query.data.map((claim) => <QrTicket key={claim.id} claim={claim} />)}
    </div>
  );
}

/* --------------------------------------------------------------------------- */
function NotificationsTab() {
  const queryClient = useQueryClient();
  const query = useNotifications();
  const readAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data.items.length) return <EmptyState title="Rien de neuf" description="Tes alertes apparaîtront ici." />;
  return (
    <div className="surface overflow-hidden bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <p className="font-semibold">{query.data.unread} non lue{query.data.unread > 1 ? "s" : ""}</p>
        <Button variant="ghost" size="sm" onClick={() => readAll.mutate()} disabled={!query.data.unread}>Tout marquer comme lu</Button>
      </div>
      <ul>
        {query.data.items.map((n) => (
          <li key={n.id} className={`border-b px-5 py-4 last:border-0 ${n.read ? "" : "bg-glow-50 dark:bg-glow-900/20"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{n.title}</p>
              <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            {n.link && (
              <Link href={n.link} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Voir <ArrowRight className="size-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------------------- */
function ProfileTab({ user }: { user: User }) {
  const { setUser } = useAuth();
  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: { full_name: user.full_name, phone: user.phone ?? "", current_password: "", new_password: "" },
  });
  const save = useMutation({
    mutationFn: (values: { full_name: string; phone: string; current_password: string; new_password: string }) =>
      api<User>("/users/me", {
        method: "PATCH",
        body: {
          full_name: values.full_name,
          phone: values.phone || null,
          ...(values.new_password ? { current_password: values.current_password, new_password: values.new_password } : {}),
        },
      }),
    onSuccess: (updated) => {
      setUser(updated);
      reset({ full_name: updated.full_name, phone: updated.phone ?? "", current_password: "", new_password: "" });
      toast.success("Profil mis à jour !");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="surface max-w-2xl space-y-5 bg-card p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Nom et prénoms"><Input {...register("full_name", { required: true })} /></FormField>
        <FormField label="Téléphone" optional><Input type="tel" {...register("phone")} /></FormField>
        <FormField label="E-mail" hint="L'e-mail ne peut pas être modifié."><Input value={user.email} disabled readOnly /></FormField>
      </div>
      <fieldset className="space-y-4 rounded-2xl border border-border p-4">
        <legend className="px-2 text-sm font-semibold">Changer de mot de passe</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Mot de passe actuel"><Input type="password" autoComplete="current-password" {...register("current_password")} /></FormField>
          <FormField label="Nouveau mot de passe"><Input type="password" autoComplete="new-password" {...register("new_password")} /></FormField>
        </div>
      </fieldset>
      <Button type="submit" disabled={save.isPending || !formState.isDirty}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}
