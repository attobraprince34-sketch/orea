"use client";

/**
 * Parcours « J'ai trouvé une pièce » en 4 étapes :
 *   1. Photo   → envoi à /ocr/scan (OCR + floutage côté serveur)
 *   2. Vérifier → formulaire pré-rempli, champs incertains signalés « À vérifier »
 *   3. Relais   → choix du point de dépôt sur la carte
 *   4. Merci    → confettis si le propriétaire cherchait déjà sa pièce
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  EyeOff,
  FileImage,
  MapPin,
  PencilLine,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Mascot } from "@/components/brand/mascot";
import { FormField, selectClassName } from "@/components/common/form-field";
import { RelayMap } from "@/components/map/relay-map";
import { RequireAuth } from "@/components/providers/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, errorMessage } from "@/lib/api";
import { celebrate } from "@/lib/confetti";
import { COMMUNES, DOC_TYPES } from "@/lib/constants";
import { today } from "@/lib/format";
import type { FoundDocument, RelayPoint, ScanResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  doc_type: z.enum(["cni", "passeport", "permis", "carte_etudiant", "carte_grise", "attestation"], {
    error: "Choisis le type de pièce.",
  }),
  holder_name: z.string().trim().min(2, { error: "Indique le nom inscrit sur la pièce." }).max(160),
  birth_date: z.string().optional().refine((v) => !v || v <= today(), { error: "Date dans le futur." }),
  document_number: z
    .string()
    .trim()
    .refine((v) => v.replace(/[^a-z0-9]/gi, "").length >= 5, { error: "Recopie le numéro inscrit sur la pièce." }),
  commune_found: z.string().min(1, { error: "Où l'as-tu trouvée ?" }),
  found_on: z.string().min(1, { error: "Indique la date." }).refine((v) => v <= today(), { error: "Date dans le futur." }),
  notes: z.string().max(500).optional(),
  relay_point_id: z.string().min(1, { error: "Choisis un point relais sur la carte." }),
});
type Values = z.infer<typeof schema>;

const STEPS = ["Photo", "Vérifier", "Point relais"] as const;

const SPECIMENS = [
  { file: "specimen_cni.jpg", label: "CNI" },
  { file: "specimen_permis.jpg", label: "Permis" },
  { file: "specimen_passeport.jpg", label: "Passeport" },
];

export function FoundWizard() {
  return <RequireAuth>{() => <Wizard />}</RequireAuth>;
}

function Wizard() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [relay, setRelay] = useState<RelayPoint | null>(null);
  const [done, setDone] = useState<{ declaration: FoundDocument; matches_found: number } | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { found_on: today(), notes: "", birth_date: "", relay_point_id: "", commune_found: "" },
  });
  const { register, formState, setValue, trigger, handleSubmit, setError } = form;

  /* --- Étape 1 : scan --------------------------------------------------- */
  const scanMutation = useMutation({
    mutationFn: (file: File) => {
      const data = new FormData();
      data.append("file", file);
      return api<ScanResult>("/ocr/scan", { method: "POST", form: data });
    },
    onSuccess: (result) => {
      setScan(result);
      const f = result.fields;
      if (f.doc_type.value) setValue("doc_type", f.doc_type.value as Values["doc_type"]);
      if (f.holder_name.value) setValue("holder_name", f.holder_name.value);
      if (f.birth_date.value) setValue("birth_date", f.birth_date.value);
      if (f.document_number.value) setValue("document_number", f.document_number.value);
      toast[result.ocr_available ? "success" : "info"](result.message);
      setStep(1);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const loadSpecimen = async (file: string) => {
    const blob = await (await fetch(`/specimens/${file}`)).blob();
    scanMutation.mutate(new File([blob], file, { type: "image/jpeg" }));
  };

  /* --- Envoi final ---------------------------------------------------------- */
  const submitMutation = useMutation({
    mutationFn: (values: Values) =>
      api<{ declaration: FoundDocument; matches_found: number }>("/found", {
        method: "POST",
        body: {
          ...values,
          birth_date: values.birth_date || null,
          notes: values.notes || null,
          upload_id: scan?.upload_id ?? null,
        },
      }),
    onSuccess: (data) => {
      setDone(data);
      queryClient.invalidateQueries({ queryKey: ["found"] });
      queryClient.invalidateQueries({ queryKey: ["public-stats"] });
      if (data.matches_found > 0) celebrate();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        Object.entries(error.fields).forEach(([f, m]) => setError(f as keyof Values, { message: m }));
        if (error.code === "UPLOAD_EXPIRED") setScan(null);
      }
      toast.error(errorMessage(error));
    },
  });

  const next = async () => {
    const ok = await trigger(["doc_type", "holder_name", "birth_date", "document_number", "commune_found", "found_on"]);
    if (ok) setStep(2);
  };

  if (done) return <FoundSuccess result={done} />;

  const review = (field: keyof ScanResult["fields"]) =>
    Boolean(scan?.ocr_available && scan.fields[field].needs_review);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <p className="eyebrow">J&apos;ai trouvé une pièce</p>
      <h1 className="display mt-3 text-[2.6rem] sm:text-6xl">Merci pour ton geste !</h1>

      {/* Indicateur d'étapes : l'anneau orange du logo marque l'étape en cours. */}
      <ol className="mt-8 flex items-center gap-2 sm:gap-4" aria-label="Progression">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3" aria-current={step === index ? "step" : undefined}>
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full border border-border text-sm font-bold transition",
                index < step && "bg-primary text-primary-foreground",
                index === step && "bg-card ring-4 ring-highlight",
                index > step && "bg-card text-muted-foreground",
              )}
            >
              {index < step ? <Check className="size-4" /> : index === step ? <span className="size-3 rounded-full bg-highlight" /> : index + 1}
            </span>
            <span className={cn("hidden text-sm font-semibold sm:inline", index !== step && "text-muted-foreground")}>{label}</span>
            {index < STEPS.length - 1 && <span className="h-0.5 flex-1 rounded bg-border" />}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit((v) => submitMutation.mutate(v))} noValidate className="mt-8">
        <AnimatePresence mode="wait">
          {/* ----------------------------- Étape 1 ----------------------------- */}
          {step === 0 && (
            <motion.section key="photo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {scanMutation.isPending ? (
                <div className="surface flex flex-col items-center bg-card px-6 py-14 text-center" role="status">
                  <Mascot mood="scan" className="h-44" />
                  <p className="mt-6 font-heading text-2xl font-bold">Ori lit la pièce…</p>
                  <p className="mt-2 text-muted-foreground">Lecture des champs et floutage des zones sensibles. Quelques secondes.</p>
                </div>
              ) : (
                <PhotoPicker onFile={(file) => scanMutation.mutate(file)} onSkip={() => setStep(1)} onSpecimen={loadSpecimen} />
              )}
            </motion.section>
          )}

          {/* ----------------------------- Étape 2 ----------------------------- */}
          {step === 1 && (
            <motion.section key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <div className="surface space-y-5 bg-card p-6 sm:p-8">
                <div>
                  <h2 className="text-2xl font-bold">Vérifie les informations</h2>
                  <p className="mt-1 text-muted-foreground">
                    {scan?.ocr_available ? scan.message : "Recopie les informations inscrites sur la pièce."}
                  </p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField label="Type de pièce" review={review("doc_type")} error={formState.errors.doc_type?.message}>
                    <select className={selectClassName} defaultValue="" {...register("doc_type")}>
                      <option value="" disabled>Choisir…</option>
                      {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Nom et prénoms" review={review("holder_name")} error={formState.errors.holder_name?.message}>
                    <Input {...register("holder_name")} />
                  </FormField>
                  <FormField label="Date de naissance" optional review={review("birth_date")} error={formState.errors.birth_date?.message}>
                    <Input type="date" max={today()} {...register("birth_date")} />
                  </FormField>
                  <FormField
                    label="Numéro de la pièce"
                    review={review("document_number")}
                    hint="Chiffré dès réception : il sert uniquement à vérifier le propriétaire."
                    error={formState.errors.document_number?.message}
                  >
                    <Input className="font-mono tracking-wider" autoComplete="off" spellCheck={false} {...register("document_number")} />
                  </FormField>
                  <FormField label="Commune où tu l'as trouvée" error={formState.errors.commune_found?.message}>
                    <select className={selectClassName} {...register("commune_found")}>
                      <option value="" disabled>Choisir…</option>
                      {COMMUNES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Trouvée le" error={formState.errors.found_on?.message}>
                    <Input type="date" max={today()} {...register("found_on")} />
                  </FormField>
                </div>
                <FormField label="Un détail utile ?" optional hint="Ex. « dans un gbaka ligne Adjamé–Yopougon ».">
                  <Textarea rows={2} {...register("notes")} />
                </FormField>
                <div className="flex flex-wrap justify-between gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(0)}><ArrowLeft /> Reprendre la photo</Button>
                  <Button type="button" onClick={next}>Continuer <ArrowRight /></Button>
                </div>
              </div>

              <aside className="space-y-4">
                {scan?.preview ? (
                  <figure className="surface overflow-hidden bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element -- miniature floutée renvoyée par l'API */}
                    <img src={scan.preview} alt="Aperçu flouté de la pièce" className="w-full" />
                    <figcaption className="flex gap-2 p-4 text-sm">
                      <EyeOff className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>
                        <strong>{scan.blurred_regions} zones floutées</strong> automatiquement. La photo originale a été supprimée.
                      </span>
                    </figcaption>
                  </figure>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-border p-5 text-sm text-muted-foreground">
                    <PencilLine className="mb-2 size-5 text-primary" />
                    Saisie manuelle : aucune photo ne sera enregistrée.
                  </div>
                )}
              </aside>
            </motion.section>
          )}

          {/* ----------------------------- Étape 3 ----------------------------- */}
          {step === 2 && (
            <motion.section key="relay" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-2xl font-bold">Où vas-tu la déposer ?</h2>
              <p className="mt-1 text-muted-foreground">Choisis le point relais le plus pratique pour toi, sur la carte ou dans la liste.</p>
              <RelayMap
                className="mt-6"
                selectedId={relay?.id}
                onSelect={(point) => {
                  setRelay(point);
                  setValue("relay_point_id", point.id, { shouldValidate: true });
                }}
              />
              {formState.errors.relay_point_id && (
                <p className="mt-3 text-sm font-medium text-destructive" role="alert">{formState.errors.relay_point_id.message}</p>
              )}
              <div className="surface mt-6 flex flex-col gap-4 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2">
                  <MapPin className="size-5 text-primary" />
                  {relay ? <span>Dépôt chez <strong>{relay.name}</strong> ({relay.commune_label})</span> : <span className="text-muted-foreground">Aucun point relais choisi</span>}
                </p>
                <div className="flex gap-3">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}><ArrowLeft /> Retour</Button>
                  <Button type="submit" variant="highlight" disabled={submitMutation.isPending}>
                    <Send /> {submitMutation.isPending ? "Envoi…" : "Valider la déclaration"}
                  </Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}

function PhotoPicker({
  onFile,
  onSkip,
  onSpecimen,
}: {
  onFile: (file: File) => void;
  onSkip: () => void;
  onSpecimen: (file: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={cn(
          "surface flex flex-col items-center justify-center bg-card px-6 py-12 text-center transition",
          dragging && "bg-glow-50 dark:bg-glow-900/20",
        )}
      >
        <span className="grid size-20 place-items-center rounded-3xl border border-border bg-highlight text-highlight-foreground">
          <Camera className="size-9" />
        </span>
        <h2 className="mt-6 text-2xl font-bold">Prends la pièce en photo</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          Bien à plat, sans reflet. Orea lit les informations et floute automatiquement les données sensibles.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          aria-label="Choisir une photo de la pièce"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" size="lg" variant="highlight" onClick={() => inputRef.current?.click()}>
            <Upload /> Prendre ou choisir une photo
          </Button>
          <Button type="button" size="lg" variant="ghost" onClick={onSkip}>
            <PencilLine /> Remplir à la main
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">JPEG, PNG ou WebP · 8 Mo maximum · tu peux aussi glisser-déposer</p>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border-2 border-dashed border-border p-5">
          <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-highlight" /> Démo : essaie un spécimen</p>
          <p className="mt-1 text-sm text-muted-foreground">Fausses pièces marquées « SPÉCIMEN », pour tester la lecture automatique.</p>
          <div className="mt-3 grid gap-2">
            {SPECIMENS.map((s) => (
              <button
                key={s.file}
                type="button"
                onClick={() => onSpecimen(s.file)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 text-left text-sm font-semibold transition hover:border-foreground/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- vignette statique */}
                <img src={`/specimens/${s.file}`} alt="" className="h-10 w-16 rounded-md object-cover" />
                <FileImage className="size-4 text-primary" /> Spécimen {s.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function FoundSuccess({ result }: { result: { declaration: FoundDocument; matches_found: number } }) {
  const { declaration, matches_found } = result;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14 text-center sm:px-6">
      <Mascot mood="party" className="mx-auto h-40" />
      <h1 className="display mt-6 text-4xl sm:text-5xl">
        {matches_found ? "Incroyable : son propriétaire la cherchait déjà !" : "Merci, tu viens de faire une belle action !"}
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        {matches_found
          ? "On vient de le prévenir. Il ne reste plus qu'à déposer la pièce au point relais."
          : "Ta déclaration est enregistrée. Si quelqu'un la cherche, il sera prévenu automatiquement."}
      </p>
      <div className="surface mt-8 bg-card p-6 text-left">
        <p className="text-sm font-semibold text-muted-foreground">Prochaine étape</p>
        <p className="mt-1 text-lg font-bold">Dépose la pièce chez « {declaration.relay_point.name} »</p>
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-4" /> {declaration.relay_point.address}, {declaration.relay_point.commune_label}</p>
        <p className="mt-3 text-sm text-muted-foreground">Dis simplement à l&apos;agent que tu viens de la part d&apos;Orea : il confirmera la réception.</p>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild><Link href="/tableau-de-bord">Suivre ma déclaration</Link></Button>
        <Button asChild variant="outline"><Link href="/">Retour à l&apos;accueil</Link></Button>
      </div>
    </div>
  );
}
