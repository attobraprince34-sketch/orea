"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Fingerprint, KeyRound, Lock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { Mascot } from "@/components/brand/mascot";
import { FormField } from "@/components/common/form-field";
import { QrTicket } from "@/components/common/qr-ticket";
import { RequireAuth } from "@/components/providers/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { celebrate } from "@/lib/confetti";
import type { Claim } from "@/lib/types";

export function ClaimFlow({ foundId }: { foundId: string }) {
  return <RequireAuth>{() => <ClaimForm foundId={foundId} />}</RequireAuth>;
}

function ClaimForm({ foundId }: { foundId: string }) {
  const queryClient = useQueryClient();
  const [number, setNumber] = useState("");
  const [claim, setClaim] = useState<Claim | null>(null);

  const mutation = useMutation({
    mutationFn: () => api<Claim>("/claims", { method: "POST", body: { found_document_id: foundId, document_number: number } }),
    onSuccess: (result) => {
      setClaim(result);
      celebrate();
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["lost"] });
    },
  });
  const error = mutation.error instanceof ApiError ? mutation.error : null;
  const locked = error?.code === "CLAIM_LOCKED";

  if (claim) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Mascot mood="party" className="mx-auto h-36" />
          <h1 className="display mt-4 text-4xl sm:text-5xl">C&apos;est bien la tienne !</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Voici ton QR code de retrait. Il t&apos;attend aussi dans ton espace, onglet « Mes QR codes ».
          </p>
        </div>
        <motion.div initial={{ opacity: 0, y: 20, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.2 }}>
          <QrTicket claim={claim} className="mt-10" />
        </motion.div>
        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link href="/tableau-de-bord?onglet=qr">Aller à mon espace <ArrowRight /></Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
      <div className="surface bg-card p-6 sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl border border-border bg-highlight text-highlight-foreground">
          <Fingerprint className="size-7" />
        </span>
        <h1 className="mt-5 text-3xl font-extrabold">Prouve que c&apos;est la tienne</h1>
        <p className="mt-2 text-muted-foreground">
          Saisis le numéro inscrit sur ta pièce. Orea compare son empreinte chiffrée avec celle de la pièce trouvée : le numéro n&apos;est jamais enregistré en clair.
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (number.trim().length >= 5) mutation.mutate();
          }}
        >
          <FormField
            label="Numéro de la pièce"
            hint="Espaces, tirets et majuscules n'ont pas d'importance."
            error={error && !locked ? error.message : undefined}
          >
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ex. CI 0099 1234 56"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-lg tracking-wider uppercase"
              disabled={locked}
              minLength={5}
              required
            />
          </FormField>

          {locked && (
            <div role="alert" className="flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <Lock className="mt-0.5 size-5 shrink-0 text-destructive" />
              <p>{error?.message}</p>
            </div>
          )}
          {error?.code === "ALREADY_CLAIMED_BY_YOU" && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/tableau-de-bord?onglet=qr">Voir mon QR code</Link>
            </Button>
          )}

          <Button type="submit" size="lg" variant="highlight" className="w-full" disabled={mutation.isPending || locked || number.trim().length < 5}>
            <KeyRound /> {mutation.isPending ? "Vérification…" : "Vérifier et obtenir mon QR code"}
          </Button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas la bonne pièce ? <Link href="/recherche" className="font-semibold text-primary hover:underline">Retour à la recherche</Link>
      </p>
    </div>
  );
}
