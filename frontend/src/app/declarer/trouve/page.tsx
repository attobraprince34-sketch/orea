import type { Metadata } from "next";

import { FoundWizard } from "./found-wizard";

export const metadata: Metadata = { title: "Déclarer une pièce trouvée" };

export default function FoundPage() {
  return <FoundWizard />;
}
