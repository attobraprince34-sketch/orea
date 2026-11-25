import type { Metadata } from "next";

import { LostForm } from "./lost-form";

export const metadata: Metadata = { title: "Déclarer une perte" };

export default function LostPage() {
  return <LostForm />;
}
