"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BellRing, MapPin, Send, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Mascot } from "@/components/brand/mascot";
import { FormField, selectClassName } from "@/components/common/form-field";
import { MatchExplainer } from "@/components/live/match-explainer";
import { SharePoster } from "@/components/live/share-poster";
import { RequireAuth } from "@/components/providers/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, errorMessage } from "@/lib/api";
import { celebrate } from "@/lib/confetti";
import { COMMUNES, DOC_POSSESSIVE, DOC_TYPES } from "@/lib/constants";
import { today } from "@/lib/format";
import type { DocType, LostReport } from "@/lib/types";

const notFuture = (v?: string) => !v || v <= today();

const schema = z.object({
  doc_type: z.enum(["cni", "passeport", "permis", "carte_etudiant", "carte_grise", "attestation"], {
    error: "Choisis le type de pièce.",
  }),
  holder_name: z.string().trim().min(2, { error: "Indique le nom inscrit sur la pièce." }).max(160),
  birth_date: z.string().optional().refine(notFuture, { error: "La date ne peut pas être dans le futur." }),
  document_number: z
    .string()
    .optional()
    .refine((v) => !v || v.replace(/[^a-z0-9]/gi, "").length >= 5, { error: "Numéro trop court." }),
  commune_lost: z.string().optional(),
  lost_on: z.string().optional().refine(notFuture, { error: "La date ne peut pas être dans le futur." }),
});
type Values = z.infer<typeof schema>;

export function LostForm() {
  return <RequireAuth>{() => <LostFormInner />}</RequireAuth>;
}

function LostFormInner() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<{ declaration: LostReport; matches_found: number } | null>(null);
  const { register, handleSubmit, formState, setError } = useForm<Values>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      api<{ declaration: LostReport; matches_found: number }>("/lost", {
        method: "POST",
        body: {
          ...values,
          birth_date: values.birth_date || null,
          document_number: values.document_number || null,
          commune_lost: values.commune_lost || null,
          lost_on: values.lost_on || null,
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["lost"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (data.matches_found > 0) celebrate();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        Object.entries(error.fields).forEach(([f, m]) => setError(f as keyof Values, { message: m }));
      }
      toast.error(errorMessage(error));
    },
  });

  if (result) return <LostSuccess result={result} />;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_340px] lg:py-14">
      <div>
        <p className="eyebrow">J&apos;ai perdu une pièce</p>
        <h1 className="display mt-3 text-[2.6rem] sm:text-6xl">Déclare ta perte</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Une minute suffit. Dès qu&apos;une pièce correspondante est signalée, tu reçois une alerte.
        </p>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="surface mt-8 space-y-5 bg-card p-6 sm:p-8" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Type de pièce" error={formState.errors.doc_type?.message}>
              <select className={selectClassName} defaultValue="" {...register("doc_type")}>
                <option value="" disabled>Choisir…</option>
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </FormField>
            <FormField label="Nom et prénoms sur la pièce" error={formState.errors.holder_name?.message}>
              <Input placeholder="KOUASSI Aya Marie" autoComplete="name" {...register("holder_name")} />
            </FormField>
            <FormField label="Date de naissance" optional hint="Aide à éviter les confusions entre homonymes." error={formState.errors.birth_date?.message}>
              <Input type="date" max={today()} {...register("birth_date")} />
            </FormField>
            <FormField
              label="Numéro de la pièce"
              optional
              hint="Si tu le connais : la correspondance devient certaine. Il est chiffré, jamais stocké en clair."
              error={formState.errors.document_number?.message}
            >
              <Input placeholder="CI 0099 1234 56" autoComplete="off" spellCheck={false} {...register("document_number")} />
            </FormField>
            <FormField label="Commune où tu l'as perdue" optional>
              <select className={selectClassName} defaultValue="" {...register("commune_lost")}>
                <option value="">Je ne sais pas</option>
                {COMMUNES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </FormField>
            <FormField label="Date de la perte" optional error={formState.errors.lost_on?.message}>
              <Input type="date" max={today()} {...register("lost_on")} />
            </FormField>
          </div>
          <Button type="submit" size="lg" variant="highlight" className="w-full sm:w-auto" disabled={mutation.isPending}>
            <Send /> {mutation.isPending ? "Envoi…" : "Déclarer ma perte"}
          </Button>
        </form>
      </div>

      <aside className="space-y-4 lg:pt-28">
        {[
          [BellRing, "Alerte immédiate", "Par e-mail et dans l'app, dès qu'une pièce correspond."],
          [ShieldCheck, "Tes infos protégées", "Ton nom n'apparaît jamais en public, seulement tes initiales."],
          [MapPin, "Retrait près de chez toi", "Dans l'un de nos points relais à Abidjan."],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof BellRing;
          return (
            <div key={title as string} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              <I className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">{title as string}</p>
                <p className="text-sm text-muted-foreground">{text as string}</p>
              </div>
            </div>
          );
        })}
      </aside>
    </div>
  );
}

function LostSuccess({ result }: { result: { declaration: LostReport; matches_found: number } }) {
  const { declaration, matches_found } = result;
  const match = declaration.matches[0];
  const possessive = DOC_POSSESSIVE[declaration.doc_type as DocType];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14 text-center sm:px-6">
      <Mascot mood={matches_found ? "party" : "search"} className="mx-auto h-40" />
      {matches_found && match ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="display mt-6 text-4xl sm:text-5xl">Bonne nouvelle, {possessive} t&apos;attend {match.relay_point.commune === "plateau" ? "au Plateau" : `à ${match.relay_point.commune_label}`} !</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Une pièce correspondant à ta déclaration a déjà été déposée chez <strong>{match.relay_point.name}</strong>.
          </p>
          <MatchExplainer score={match.score} reasons={match.reasons} className="surface mx-auto mt-8 max-w-lg p-5 text-left" />
          <Button asChild size="lg" variant="highlight" className="mt-8">
            <Link href={`/reclamer/${match.found_document_id}`}>C&apos;est la mienne, je la récupère <ArrowRight /></Link>
          </Button>
        </motion.div>
      ) : (
        <>
          <h1 className="display mt-6 text-4xl sm:text-5xl">C&apos;est noté, on veille pour toi</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Ta déclaration est enregistrée. Dès qu&apos;une pièce correspondante est signalée, tu reçois un e-mail et une notification.
          </p>
          <div className="surface mx-auto mt-8 max-w-md p-6 text-left">
            <p className="font-heading text-lg font-bold">Mets toutes les chances de ton côté</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Partage ton avis de recherche dans tes groupes WhatsApp. Celui qui trouve ta pièce scanne le code et la déclare
              en une minute.
            </p>
            <SharePoster lost={declaration} className="mt-4" />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild><Link href="/tableau-de-bord">Suivre ma déclaration</Link></Button>
            <Button asChild variant="outline"><Link href="/recherche">Chercher dans les pièces trouvées</Link></Button>
          </div>
        </>
      )}
    </div>
  );
}
