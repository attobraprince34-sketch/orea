"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, LogIn, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { homeFor, useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";

const schema = z.object({
  email: z.email({ error: "Cette adresse e-mail ne semble pas valide." }),
  password: z.string().min(1, { error: "Saisis ton mot de passe." }),
});
type Values = z.infer<typeof schema>;

/** Comptes créés par le script de démonstration (données fictives). */
const DEMO_ACCOUNTS = [
  { label: "Aya · a perdu sa CNI", email: "aya@orea.ci" },
  { label: "Koffi · a trouvé une pièce", email: "koffi@orea.ci" },
  { label: "Agent relais · Cocody", email: "relais.cocody@orea.ci" },
  { label: "Administrateur", email: "admin@orea.ci" },
];
const DEMO_PASSWORD = "Orea2026!";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("suite");
  const { login } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const { register, handleSubmit, setValue, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      const user = await login(email, password);
      toast.success(`Bon retour, ${user.full_name.split(" ")[0]} !`);
      router.push(next && next.startsWith("/") ? next : homeFor(user));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormField label="E-mail" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="toi@exemple.ci" {...register("email")} />
        </FormField>
        <FormField label="Mot de passe" error={formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register("password")} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting}>
          <LogIn /> {formState.isSubmitting ? "Connexion…" : "Se connecter"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-primary hover:underline">Crée-le en 30 secondes</Link>
      </p>

      {/* Raccourcis pour la démonstration devant le jury */}
      <div className="mt-6 rounded-2xl border-2 border-dashed border-border p-4">
        <button
          type="button"
          onClick={() => setShowDemo((v) => !v)}
          aria-expanded={showDemo}
          className="flex w-full items-center justify-between text-sm font-semibold"
        >
          <span className="flex items-center gap-2"><Sparkles className="size-4 text-highlight" /> Comptes de démonstration</span>
          <ChevronDown className={`size-4 transition ${showDemo ? "rotate-180" : ""}`} />
        </button>
        {showDemo && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setValue("email", account.email, { shouldValidate: true });
                  setValue("password", DEMO_PASSWORD, { shouldValidate: true });
                }}
                className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-left text-xs transition hover:border-foreground/30"
              >
                <span className="block font-semibold">{account.label}</span>
                <span className="text-muted-foreground">{account.email}</span>
              </button>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">Mot de passe : {DEMO_PASSWORD}</p>
          </div>
        )}
      </div>
    </>
  );
}
