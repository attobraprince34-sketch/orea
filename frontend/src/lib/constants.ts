/**
 * Libellés et couleurs partagés (alignés sur les énumérations du backend).
 */

import type { DeclarationStatus, DocType } from "@/lib/types";

export const DOC_TYPES: { value: DocType; label: string; short: string }[] = [
  { value: "cni", label: "Carte nationale d'identité", short: "CNI" },
  { value: "passeport", label: "Passeport", short: "Passeport" },
  { value: "permis", label: "Permis de conduire", short: "Permis" },
  { value: "carte_etudiant", label: "Carte d'étudiant", short: "Carte d'étudiant" },
  { value: "carte_grise", label: "Carte grise", short: "Carte grise" },
  { value: "attestation", label: "Attestation d'identité", short: "Attestation" },
];

export const DOC_TYPE_LABEL = Object.fromEntries(DOC_TYPES.map((d) => [d.value, d.label])) as Record<
  DocType,
  string
>;

/** « ta CNI », « ton passeport »… pour des messages naturels. */
export const DOC_POSSESSIVE: Record<DocType, string> = {
  cni: "ta CNI",
  passeport: "ton passeport",
  permis: "ton permis",
  carte_etudiant: "ta carte d'étudiant",
  carte_grise: "ta carte grise",
  attestation: "ton attestation",
};

export const COMMUNES: { value: string; label: string }[] = [
  { value: "abobo", label: "Abobo" },
  { value: "adjame", label: "Adjamé" },
  { value: "anyama", label: "Anyama" },
  { value: "attecoube", label: "Attécoubé" },
  { value: "bingerville", label: "Bingerville" },
  { value: "cocody", label: "Cocody" },
  { value: "koumassi", label: "Koumassi" },
  { value: "marcory", label: "Marcory" },
  { value: "plateau", label: "Plateau" },
  { value: "port_bouet", label: "Port-Bouët" },
  { value: "songon", label: "Songon" },
  { value: "treichville", label: "Treichville" },
  { value: "yopougon", label: "Yopougon" },
];

export const COMMUNE_LABEL = Object.fromEntries(COMMUNES.map((c) => [c.value, c.label]));

/** Style des badges de statut : couleur ET icône (jamais la couleur seule). */
export const STATUS_STYLE: Record<DeclarationStatus, { label: string; className: string }> = {
  pending: {
    label: "En attente",
    className: "bg-muted text-foreground border-border",
  },
  matched: {
    label: "Correspondance trouvée",
    className: "bg-glow-100 text-glow-800 border-glow-300 dark:bg-glow-900/40 dark:text-glow-200",
  },
  claimed: {
    label: "Réclamée",
    className: "bg-brand-100 text-brand-800 border-brand-300 dark:bg-brand-900/60 dark:text-brand-200",
  },
  returned: {
    label: "Restituée",
    className: "bg-brand-700 text-white border-brand-800 dark:bg-brand-300 dark:text-brand-950",
  },
  expired: {
    label: "Expirée",
    className: "bg-muted text-muted-foreground border-border",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-muted text-muted-foreground border-border line-through",
  },
};

/** Coordonnées du centre d'Abidjan pour la carte. */
export const ABIDJAN_CENTER: [number, number] = [5.345, -4.02];

/** « à Cocody », mais « au Plateau ». */
export function atCommune(commune: string, label: string): string {
  return commune === "plateau" ? "au Plateau" : `à ${label}`;
}

/** Centres approximatifs des communes (carte thermique du centre de contrôle). */
export const COMMUNE_CENTERS: Record<string, [number, number]> = {
  abobo: [5.4232, -4.0207],
  adjame: [5.3611, -4.0233],
  anyama: [5.4944, -4.0517],
  attecoube: [5.3367, -4.0398],
  bingerville: [5.3557, -3.8886],
  cocody: [5.3602, -3.9811],
  koumassi: [5.2985, -3.9483],
  marcory: [5.3033, -3.9827],
  plateau: [5.3237, -4.0197],
  port_bouet: [5.2556, -3.9262],
  songon: [5.3247, -4.2547],
  treichville: [5.2928, -4.0108],
  yopougon: [5.3456, -4.0821],
};
