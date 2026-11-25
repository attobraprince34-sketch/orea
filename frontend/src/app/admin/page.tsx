import type { Metadata } from "next";

import { AdminSpace } from "./admin-space";

export const metadata: Metadata = { title: "Administration" };

export default function AdminPage() {
  return <AdminSpace />;
}
