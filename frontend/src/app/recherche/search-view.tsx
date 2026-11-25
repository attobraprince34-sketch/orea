"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, MapPin, Search, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/feedback/states";
import { selectClassName } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { COMMUNES, DOC_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { SearchItem } from "@/lib/types";

export function SearchView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const name = params.get("nom") ?? "";
  const docType = params.get("type") ?? "";
  const commune = params.get("commune") ?? "";
  const [draft, setDraft] = useState({ name, docType, commune });

  const query = useQuery({
    queryKey: ["search", name, docType, commune],
    queryFn: () =>
      api<SearchItem[]>("/search", { query: { name, doc_type: docType, commune, limit: 30 } }),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draft.name.trim()) next.set("nom", draft.name.trim());
    if (draft.docType) next.set("type", draft.docType);
    if (draft.commune) next.set("commune", draft.commune);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <h1 className="display text-[2.6rem] sm:text-6xl">Cherche ta pièce</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Tape ton nom tel qu&apos;il apparaît sur ta pièce. Pas besoin d&apos;être exact : Orea tolère les fautes et l&apos;ordre des prénoms.
      </p>

      <form onSubmit={submit} className="surface mt-8 grid gap-3 bg-card p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto]" role="search">
        <div>
          <label htmlFor="q-name" className="sr-only">Nom et prénoms</label>
          <Input id="q-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nom et prénoms" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="q-type" className="sr-only">Type de pièce</label>
          <select id="q-type" className={selectClassName} value={draft.docType} onChange={(e) => setDraft({ ...draft, docType: e.target.value })}>
            <option value="">Toutes les pièces</option>
            {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="q-commune" className="sr-only">Commune du point relais</label>
          <select id="q-commune" className={selectClassName} value={draft.commune} onChange={(e) => setDraft({ ...draft, commune: e.target.value })}>
            <option value="">Toutes les communes</option>
            {COMMUNES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <Button type="submit" variant="highlight"><Search /> Chercher</Button>
      </form>

      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" />
        Pour protéger chacun, seuls le type de pièce, les initiales et la commune sont affichés.
      </p>

      <section aria-live="polite" className="mt-10">
        {query.isPending && <LoadingState label="Ori fouille les points relais…" />}
        {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
        {query.data && query.data.length === 0 && (
          <EmptyState
            title={name ? "Rien pour l'instant…" : "Aucune pièce en attente"}
            description="Ta pièce n'a pas encore été signalée. Déclare ta perte : on te prévient dès qu'elle refait surface, même la nuit."
            action={
              <Button asChild variant="highlight">
                <Link href="/declarer/perdu">Déclarer ma perte <ArrowRight /></Link>
              </Button>
            }
          />
        )}
        {query.data && query.data.length > 0 && (
          <>
            <p className="mb-4 font-semibold">
              {query.data.length} pièce{query.data.length > 1 ? "s" : ""} {name ? "qui pourrai(en)t être la tienne" : "en attente de leur propriétaire"}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {query.data.map((item, index) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.4) }}
                  className="surface surface-hover flex flex-col bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{item.doc_type_label}</span>
                    {item.score !== null && item.score >= 90 && (
                      <span className="rounded-full bg-glow-100 px-2.5 py-1 text-xs font-semibold text-glow-800">Très proche</span>
                    )}
                  </div>
                  <p className="mt-4 font-heading text-3xl font-extrabold tracking-wider">{item.holder_initials}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" /> Au point relais de {item.commune_label}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="size-4" /> Trouvée le {formatDate(item.found_on)}</p>
                  <Button asChild variant="outline" className="mt-5">
                    <Link href={`/reclamer/${item.id}`}>C&apos;est la mienne <ArrowRight /></Link>
                  </Button>
                </motion.li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
