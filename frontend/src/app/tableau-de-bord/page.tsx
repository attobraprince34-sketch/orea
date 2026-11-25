import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/feedback/states";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Mon espace" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingState label="Un instant…" />}>
      <Dashboard />
    </Suspense>
  );
}
