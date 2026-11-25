import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/feedback/states";
import { ClaimFlow } from "./claim-flow";

export const metadata: Metadata = { title: "Réclamer une pièce" };

/** Les paramètres d'URL sont des données « à la requête » : lus sous Suspense. */
export default function ClaimPage(props: PageProps<"/reclamer/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Un instant…" />}>
      <ClaimContent params={props.params} />
    </Suspense>
  );
}

async function ClaimContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClaimFlow foundId={id} />;
}
