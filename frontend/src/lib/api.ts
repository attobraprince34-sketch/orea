/**
 * Client HTTP de l'API Orea.
 *
 * - Les appels passent par /api/v1 (même origine, réécrit par Next.js vers FastAPI) :
 *   le cookie httpOnly du refresh token est donc envoyé sans configuration CORS.
 * - Le jeton d'accès vit uniquement en mémoire (jamais dans localStorage).
 * - Sur une réponse 401, la session est rafraîchie une fois puis la requête rejouée.
 * - Les erreurs de l'API arrivent déjà en français : on les remonte telles quelles.
 */

import type { TokenOut } from "@/lib/types";

const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  extra: Record<string, unknown>;

  constructor(status: number, code: string, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = (body.fields as Record<string, string>) ?? {};
    this.extra = body;
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<TokenOut | null> | null = null;
const sessionListeners = new Set<(session: TokenOut | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function onSessionChange(listener: (session: TokenOut | null) => void) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function emitSession(session: TokenOut | null) {
  sessionListeners.forEach((listener) => listener(session));
}

/** Rafraîchit la session via le cookie httpOnly. Une seule requête à la fois. */
export function refreshSession(): Promise<TokenOut | null> {
  refreshInFlight ??= fetch(`${API_PREFIX}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(async (response) => {
      if (!response.ok) {
        setAccessToken(null);
        emitSession(null);
        return null;
      }
      const session = (await response.json()) as TokenOut;
      setAccessToken(session.access_token);
      emitSession(session);
      return session;
    })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | boolean | null | undefined>;
  retry?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, form, query, retry = true } = options;

  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const url = `${API_PREFIX}${path}${params.size ? `?${params}` : ""}`;

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: "include",
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Connexion impossible. Vérifie ta connexion internet et réessaie.");
  }

  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    const session = await refreshSession();
    if (session) return api<T>(path, { ...options, retry: false });
  }

  if (!response.ok) {
    let payload: Record<string, unknown> = {};
    try {
      payload = await response.json();
    } catch {
      /* réponse non JSON (proxy, panne) */
    }
    throw new ApiError(
      response.status,
      String(payload.code ?? `HTTP_${response.status}`),
      String(payload.message ?? "Oups, quelque chose s'est mal passé. Réessaie dans un instant."),
      payload,
    );
  }

  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? response.json() : response.blob()) as Promise<T>;
}

/** Message d'erreur lisible, quelle que soit l'erreur. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Oups, quelque chose s'est mal passé. Réessaie dans un instant.";
}
