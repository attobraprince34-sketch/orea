import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/feedback/states";
import { SearchView } from "./search-view";

export const metadata: Metadata = { title: "Rechercher une pièce" };

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SearchView />
    </Suspense>
  );
}
