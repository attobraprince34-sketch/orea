"use client";

/** Protège une page côté interface (le vrai contrôle d'accès est fait par l'API). */

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LoadingState } from "@/components/feedback/states";
import { homeFor, useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import type { Role, User } from "@/lib/types";

export function RequireAuth({
  roles,
  children,
}: {
  roles?: Role[];
  children: (user: User) => ReactNode;
}) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/connexion?suite=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "authenticated" || !user) return <LoadingState label="Un instant…" className="py-24" />;

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <span className="grid size-14 place-items-center rounded-2xl border border-border bg-secondary">
          <Lock className="size-6 text-primary" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Cet espace est réservé</h1>
        <p className="mt-2 text-muted-foreground">Ton compte n&apos;a pas accès à cette page.</p>
        <Button asChild className="mt-6">
          <Link href={homeFor(user)}>Retour à mon espace</Link>
        </Button>
      </div>
    );
  }
  return <>{children(user)}</>;
}
