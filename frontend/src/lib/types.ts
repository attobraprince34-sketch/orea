/**
 * Types partagés avec l'API (miroir des schémas Pydantic du backend).
 */

export type Role = "user" | "relay" | "admin";
export type DocType =
  | "cni"
  | "passeport"
  | "permis"
  | "carte_etudiant"
  | "carte_grise"
  | "attestation";
export type DeclarationStatus =
  | "pending"
  | "matched"
  | "claimed"
  | "returned"
  | "expired"
  | "cancelled";
export type ClaimStatus = "active" | "completed" | "expired" | "cancelled";
export type NotificationKind = "match" | "received" | "claim" | "returned" | "system";

export interface Option {
  value: string;
  label: string;
}

export interface RelayPointBrief {
  id: string;
  name: string;
  commune: string;
  commune_label: string;
  address: string;
}

export interface RelayPoint extends RelayPointBrief {
  latitude: number;
  longitude: number;
  opening_hours: string;
  phone: string | null;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  relay_point: RelayPointBrief | null;
  created_at: string;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface FoundDocument {
  id: string;
  doc_type: DocType;
  doc_type_label: string;
  holder_name: string;
  holder_initials: string;
  birth_date: string | null;
  commune_found: string;
  found_on: string;
  notes: string | null;
  status: DeclarationStatus;
  status_label: string;
  relay_point: RelayPointBrief;
  has_photo: boolean;
  received_at: string | null;
  returned_at: string | null;
  created_at: string;
}

export interface MatchForOwner {
  match_id: string;
  found_document_id: string;
  score: number;
  found_on: string;
  status: DeclarationStatus;
  received_by_relay: boolean;
  relay_point: RelayPointBrief;
  /** Pourquoi Orea pense que c'est la bonne pièce (sans jamais révéler de valeur). */
  reasons: string[];
}

export interface LostReport {
  id: string;
  doc_type: DocType;
  doc_type_label: string;
  holder_name: string;
  birth_date: string | null;
  commune_lost: string | null;
  lost_on: string | null;
  has_number: boolean;
  status: DeclarationStatus;
  status_label: string;
  matches: MatchForOwner[];
  created_at: string;
}

export interface SearchItem {
  id: string;
  doc_type: DocType;
  doc_type_label: string;
  holder_initials: string;
  commune: string;
  commune_label: string;
  found_on: string;
  score: number | null;
}

export interface Pickup {
  qr_payload: string;
  short_code: string;
  expires_at: string;
  used_at: string | null;
}

export interface Claim {
  id: string;
  status: ClaimStatus;
  doc_type: DocType;
  doc_type_label: string;
  holder_initials: string;
  relay_point: RelayPointBrief;
  received_by_relay: boolean;
  pickup: Pickup | null;
  created_at: string;
  completed_at: string | null;
}

export interface PickupPreview {
  claim_id: string;
  found_document_id: string;
  doc_type: DocType;
  doc_type_label: string;
  holder_name: string;
  claimant_name: string;
  claimant_phone: string | null;
  expires_at: string;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface OcrField {
  value: string | null;
  confidence: number;
  needs_review: boolean;
}

export interface ScanResult {
  ocr_available: boolean;
  message: string;
  upload_id: string | null;
  preview: string | null;
  blurred_regions: number;
  duration_ms: number;
  fields: {
    doc_type: OcrField;
    surname: OcrField;
    given_names: OcrField;
    holder_name: OcrField;
    birth_date: OcrField;
    document_number: OcrField;
  };
}

export interface PublicStats {
  documents_found: number;
  documents_returned: number;
  success_rate: number;
  relay_points: number;
  communes_covered: number;
}

export interface CountByLabel {
  key: string;
  label: string;
  count: number;
}

export interface AdminStats {
  users: number;
  documents_found: number;
  lost_reports: number;
  matches: number;
  documents_returned: number;
  pending_at_relays: number;
  success_rate: number;
  average_days_to_return: number | null;
  by_commune: CountByLabel[];
  by_doc_type: CountByLabel[];
  by_status: CountByLabel[];
  timeline: { day: string; found: number; lost: number; returned: number }[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface DeclarationAdmin {
  id: string;
  kind: "found" | "lost";
  doc_type: DocType;
  doc_type_label: string;
  holder_name: string;
  commune: string | null;
  status: DeclarationStatus;
  status_label: string;
  author_name: string;
  author_email: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface ActivityItem {
  kind: "found" | "match" | "returned";
  doc_type: DocType;
  doc_type_label: string;
  commune: string;
  commune_label: string;
  at: string;
}
