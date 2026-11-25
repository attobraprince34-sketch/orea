"use client";

import { ErrorState } from "@/components/feedback/states";

/** Erreur inattendue dans une page : message clair et bouton pour réessayer. */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-20">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
