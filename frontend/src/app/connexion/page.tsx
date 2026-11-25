import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <AuthShell title="Bon retour !" subtitle="Connecte-toi pour suivre tes déclarations et tes QR codes.">
      {/* useSearchParams (lien de retour) nécessite une frontière Suspense. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
