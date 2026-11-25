"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, FileClock, Plus, ScrollText, Search, ShieldAlert, Store, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageTransition } from "@/components/common/motion";
import { FormField, selectClassName } from "@/components/common/form-field";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback/states";
import { RequireAuth } from "@/components/providers/require-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api";
import { COMMUNES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry, DeclarationAdmin, DeclarationStatus, Page, RelayPoint, Role, User } from "@/lib/types";
import { CommandCenter } from "./command-center";

export function AdminSpace() {
  return <RequireAuth roles={["admin"]}>{() => <AdminInner />}</RequireAuth>;
}

function AdminInner() {
  return (
    <PageTransition className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <p className="eyebrow">Administration</p>
      <h1 className="display mt-3 text-[2.6rem] sm:text-6xl">Tableau de bord</h1>
      <Tabs defaultValue="stats" className="mt-8">
        <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto rounded-full bg-muted p-1 sm:w-fit">
          {[
            ["stats", "Vue d'ensemble", BarChart3],
            ["relays", "Points relais", Store],
            ["users", "Utilisateurs", Users],
            ["moderation", "Modération", ShieldAlert],
            ["audit", "Journal", ScrollText],
          ].map(([value, label, Icon]) => {
            const I = Icon as typeof Store;
            return (
              <TabsTrigger key={value as string} value={value as string} className="h-10 flex-none gap-2 rounded-full px-4 text-muted-foreground data-[state=active]:bg-ink data-[state=active]:text-ink-foreground data-[state=active]:shadow-none">
                <I className="size-4" /> {label as string}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value="stats" className="mt-6"><CommandCenter /></TabsContent>
        <TabsContent value="relays" className="mt-6"><RelaysTab /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
        <TabsContent value="moderation" className="mt-6"><ModerationTab /></TabsContent>
        <TabsContent value="audit" className="mt-6"><AuditTab /></TabsContent>
      </Tabs>
    </PageTransition>
  );
}

/* --------------------------------------------------------------------------- */
/* --------------------------------------------------------------------------- */
type RelayForm = Omit<RelayPoint, "id" | "commune_label" | "is_active"> & { is_active: boolean };

function RelaysTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-relays"], queryFn: () => api<RelayPoint[]>("/admin/relay-points") });
  const [editing, setEditing] = useState<RelayPoint | "new" | null>(null);
  const toggle = useMutation({
    mutationFn: (relay: RelayPoint) => api(`/admin/relay-points/${relay.id}`, { method: "PATCH", body: { is_active: !relay.is_active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-relays"] });
      queryClient.invalidateQueries({ queryKey: ["relay-points"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}><Plus /> Ajouter un point relais</Button>
      </div>
      <div className="surface overflow-x-auto bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="px-4 py-3">Nom</th><th>Commune</th><th>Horaires</th><th>Actif</th><th className="px-4"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {query.data.map((relay) => (
              <tr key={relay.id} className="border-t">
                <td className="px-4 py-3"><p className="font-semibold">{relay.name}</p><p className="text-xs text-muted-foreground">{relay.address}</p></td>
                <td>{relay.commune_label}</td>
                <td className="text-muted-foreground">{relay.opening_hours}</td>
                <td><Switch checked={relay.is_active} onCheckedChange={() => toggle.mutate(relay)} aria-label={`Activer ${relay.name}`} /></td>
                <td className="px-4 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(relay)}>Modifier</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RelayDialog relay={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function RelayDialog({ relay, onClose }: { relay: RelayPoint | "new" | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editing = relay && relay !== "new" ? relay : null;
  const { register, handleSubmit } = useForm<RelayForm>({
    values: editing
      ? { name: editing.name, commune: editing.commune, address: editing.address, latitude: editing.latitude, longitude: editing.longitude, opening_hours: editing.opening_hours, phone: editing.phone, is_active: editing.is_active }
      : { name: "", commune: "cocody", address: "", latitude: 5.35, longitude: -4.0, opening_hours: "Lun–Ven · 8h–17h", phone: "", is_active: true },
  });
  const save = useMutation({
    mutationFn: (values: RelayForm) => {
      const body = { ...values, latitude: Number(values.latitude), longitude: Number(values.longitude), phone: values.phone || null };
      return editing
        ? api(`/admin/relay-points/${editing.id}`, { method: "PATCH", body })
        : api("/admin/relay-points", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Point relais mis à jour." : "Point relais ajouté à la carte !");
      queryClient.invalidateQueries({ queryKey: ["admin-relays"] });
      queryClient.invalidateQueries({ queryKey: ["relay-points"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={Boolean(relay)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl border border-border sm:max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Modifier le point relais" : "Nouveau point relais"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nom" className="sm:col-span-2"><Input {...register("name", { required: true })} /></FormField>
          <FormField label="Commune">
            <select className={selectClassName} {...register("commune")}>{COMMUNES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          </FormField>
          <FormField label="Téléphone" optional><Input {...register("phone")} /></FormField>
          <FormField label="Adresse" className="sm:col-span-2"><Input {...register("address", { required: true })} /></FormField>
          <FormField label="Latitude"><Input type="number" step="0.0001" {...register("latitude")} /></FormField>
          <FormField label="Longitude"><Input type="number" step="0.0001" {...register("longitude")} /></FormField>
          <FormField label="Horaires" className="sm:col-span-2"><Input {...register("opening_hours")} /></FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------------------- */
function UsersTab() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => api<Page<User>>("/admin/users", { query: { q: search, size: 50 } }),
  });
  const relays = useQuery({ queryKey: ["admin-relays"], queryFn: () => api<RelayPoint[]>("/admin/relay-points") });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/admin/users/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.success("Utilisateur mis à jour.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); setSearch(q); }} className="mb-4 flex max-w-md gap-2" role="search">
        <label htmlFor="user-q" className="sr-only">Rechercher un utilisateur</label>
        <Input id="user-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou e-mail" />
        <Button type="submit" variant="outline"><Search /> Chercher</Button>
      </form>
      {users.isPending ? <LoadingState /> : users.isError ? <ErrorState error={users.error} onRetry={() => users.refetch()} /> : (
        <div className="surface overflow-x-auto bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted text-left"><tr><th className="px-4 py-3">Utilisateur</th><th>Rôle</th><th>Point relais</th><th>Actif</th></tr></thead>
            <tbody>
              {users.data.items.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3"><p className="font-semibold">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                  <td>
                    <select
                      aria-label={`Rôle de ${u.full_name}`}
                      className={`${selectClassName} h-9 w-36`}
                      value={u.role}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        const relay = role === "relay" ? u.relay_point?.id ?? relays.data?.[0]?.id : undefined;
                        update.mutate({ id: u.id, body: { role, ...(relay ? { relay_point_id: relay } : {}) } });
                      }}
                    >
                      <option value="user">Utilisateur</option>
                      <option value="relay">Agent relais</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    {u.role === "relay" ? (
                      <select
                        aria-label={`Point relais de ${u.full_name}`}
                        className={`${selectClassName} h-9 w-48`}
                        value={u.relay_point?.id ?? ""}
                        onChange={(e) => update.mutate({ id: u.id, body: { relay_point_id: e.target.value } })}
                      >
                        {relays.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td><Switch checked={u.is_active} onCheckedChange={(v) => update.mutate({ id: u.id, body: { is_active: v } })} aria-label={`Compte actif : ${u.full_name}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------- */
const STATUSES: { value: DeclarationStatus; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "matched", label: "Correspondance trouvée" },
  { value: "claimed", label: "Réclamée" },
  { value: "returned", label: "Restituée" },
  { value: "expired", label: "Expirée" },
  { value: "cancelled", label: "Annulée" },
];

function ModerationTab() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"found" | "lost">("found");
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["admin-declarations", kind, status],
    queryFn: () => api<Page<DeclarationAdmin>>("/admin/declarations", { query: { kind, status, size: 50 } }),
  });
  const moderate = useMutation({
    mutationFn: ({ id, value }: { id: string; value: DeclarationStatus }) =>
      api(`/admin/declarations/${kind}/${id}`, { method: "PATCH", body: { status: value, reason: "Modération" } }),
    onSuccess: () => {
      toast.success("Statut modifié (action enregistrée dans le journal).");
      queryClient.invalidateQueries({ queryKey: ["admin-declarations"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div role="tablist" aria-label="Type de déclaration" className="flex gap-1 rounded-full border border-border bg-card p-1">
          {([["found", "Pièces trouvées"], ["lost", "Pertes"]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => setKind(value)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${kind === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <label htmlFor="mod-status" className="sr-only">Filtrer par statut</label>
        <select id="mod-status" className={`${selectClassName} w-56`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {query.isPending ? <LoadingState /> : query.isError ? <ErrorState error={query.error} /> : query.data.items.length === 0 ? (
        <EmptyState title="Rien à modérer" description="Aucune déclaration ne correspond à ce filtre." />
      ) : (
        <div className="surface overflow-x-auto bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted text-left"><tr><th className="px-4 py-3">Déclaration</th><th>Auteur</th><th>Date</th><th>Statut</th><th>Changer</th></tr></thead>
            <tbody>
              {query.data.items.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3"><p className="font-semibold">{d.holder_name}</p><p className="text-xs text-muted-foreground">{d.doc_type_label}</p></td>
                  <td><p>{d.author_name}</p><p className="text-xs text-muted-foreground">{d.author_email}</p></td>
                  <td className="text-muted-foreground">{formatDateTime(d.created_at)}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>
                    <select aria-label={`Changer le statut de ${d.holder_name}`} className={`${selectClassName} h-9 w-48`} value={d.status}
                      onChange={(e) => moderate.mutate({ id: d.id, value: e.target.value as DeclarationStatus })}>
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------- */
const ACTION_LABELS: Record<string, string> = {
  "found.created": "Pièce trouvée déclarée",
  "lost.created": "Perte déclarée",
  "lost.cancelled": "Perte clôturée",
  "found.received": "Réception au relais",
  "claim.verified": "Numéro vérifié, QR émis",
  "claim.failed": "Échec de vérification",
  "pickup.scanned": "QR scanné",
  "pickup.completed": "Pièce restituée",
  "declaration.moderated": "Modération",
  "relay.created": "Point relais créé",
  "relay.updated": "Point relais modifié",
  "relay.deactivated": "Point relais désactivé",
  "user.updated": "Utilisateur modifié",
};

function AuditTab() {
  const query = useQuery({ queryKey: ["admin-audit"], queryFn: () => api<AuditEntry[]>("/admin/audit", { query: { limit: 150 } }) });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <div className="surface overflow-hidden bg-card">
      <ul>
        {query.data.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-3 text-sm last:border-0">
            <FileClock className={`size-4 ${entry.action === "claim.failed" ? "text-destructive" : "text-primary"}`} />
            <span className="font-semibold">{ACTION_LABELS[entry.action] ?? entry.action}</span>
            <span className="font-mono text-xs text-muted-foreground">{entry.target?.slice(0, 8)}</span>
            <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
