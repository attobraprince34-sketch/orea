import Link from "next/link";

import { Mascot } from "@/components/brand/mascot";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Mascot mood="search" className="h-40" />
      <p className="mt-6 font-heading text-6xl font-extrabold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">Cette page s&apos;est perdue…</h1>
      <p className="mt-3 text-muted-foreground">Ironique, non ? Ori la cherche encore. En attendant, reviens à l&apos;accueil.</p>
      <Button asChild className="mt-8"><Link href="/">Retour à l&apos;accueil</Link></Button>
    </div>
  );
}
