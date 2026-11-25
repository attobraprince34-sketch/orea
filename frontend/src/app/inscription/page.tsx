import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default function RegisterPage() {
  return (
    <AuthShell title="Rejoins Orea" subtitle="Gratuit, rapide, et tes données restent protégées." mood="party">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
