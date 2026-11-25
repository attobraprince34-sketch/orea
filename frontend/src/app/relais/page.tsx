import type { Metadata } from "next";

import { RelaySpace } from "./relay-space";

export const metadata: Metadata = { title: "Espace point relais" };

export default function RelayPage() {
  return <RelaySpace />;
}
