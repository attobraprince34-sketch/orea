"use client";

/**
 * Session utilisateur.
 *
 * Au chargement, on tente de restaurer la session à partir du cookie httpOnly
 * (POST /auth/refresh). Le jeton d'accès reste en mémoire : un simple
 * rechargement de page ne déconnecte pas, mais aucun script ne peut le voler
 * dans le stockage du navigateur.
 */

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, onSessionChange, refreshSession, setAccessToken } from "@/lib/api";
import type { TokenOut, User } from "@/lib/types";

type Status = "loading" | "authenticated" | "anonymous";

interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onSessionChange((session) => {
      setUser(session?.user ?? null);
      setStatus(session ? "authenticated" : "anonymous");
    });
    refreshSession().then((session) => {
      if (!session) setStatus("anonymous");
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const applySession = useCallback((session: TokenOut) => {
    setAccessToken(session.access_token);
    setUser(session.user);
    setStatus("authenticated");
    return session.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      applySession(await api<TokenOut>("/auth/login", { method: "POST", body: { email, password } })),
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) =>
      applySession(await api<TokenOut>("/auth/register", { method: "POST", body: input })),
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("anonymous");
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, status, login, register, logout, setUser }),
    [user, status, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return context;
}

/** Page d'accueil de chaque rôle après connexion. */
export function homeFor(user: User): string {
  if (user.role === "admin") return "/admin";
  if (user.role === "relay") return "/relais";
  return "/tableau-de-bord";
}
