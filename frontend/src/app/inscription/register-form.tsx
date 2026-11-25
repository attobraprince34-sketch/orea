"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api";

const schema = z.object({
  full_name: z.string().trim().min(2, { error: "Indique ton nom (2 caractères minimum)." }).max(120),
  email: z.email({ error: "Cette adresse e-mail ne semble pas valide." }),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9 ]{8,20})?$/, { error: "Numéro invalide (ex. +225 07 00 00 00 00)." })
    .optional(),
  password: z
    .string()
    .min(8, { error: "8 caractères minimum." })
    .max(64)
    .refine((v) => /\d/.test(v) && /[a-zA-Z]/.test(v), { error: "Ajoute au moins une lettre et un chiffre." }),
});
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const next = useSearchParams().get("suite");
  const { register: signUp } = useAuth();
  const { register, handleSubmit, formState, setError } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await signUp({ ...values, phone: values.phone || undefined });
      toast.success(`Bienvenue sur Orea, ${user.full_name.split(" ")[0]} !`);
      router.push(next && next.startsWith("/") ? next : "/tableau-de-bord");
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fields).forEach(([field, message]) =>
          setError(field as keyof Values, { message }),
        );
      }
      toast.error(errorMessage(error));
    }
  });

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormField label="Nom et prénoms" error={formState.errors.full_name?.message}>
          <Input autoComplete="name" placeholder="Aya Kouassi" {...register("full_name")} />
        </FormField>
        <FormField label="E-mail" error={formState.errors.email?.message} hint="On t'écrit ici quand ta pièce est retrouvée.">
          <Input type="email" autoComplete="email" placeholder="toi@exemple.ci" {...register("email")} />
        </FormField>
        <FormField label="Téléphone" optional error={formState.errors.phone?.message}>
          <Input type="tel" autoComplete="tel" placeholder="+225 07 00 00 00 00" {...register("phone")} />
        </FormField>
        <FormField label="Mot de passe" error={formState.errors.password?.message} hint="8 caractères minimum, avec une lettre et un chiffre.">
          <Input type="password" autoComplete="new-password" {...register("password")} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting}>
          <UserPlus /> {formState.isSubmitting ? "Création…" : "Créer mon compte"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà inscrit ?{" "}
        <Link href={`/connexion${next ? `?suite=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary hover:underline">
          Connecte-toi
        </Link>
      </p>
    </>
  );
}
