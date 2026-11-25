"use client";

import { LayoutDashboard, LogOut, Menu, ShieldCheck, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { homeFor, useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/recherche", label: "Rechercher" },
  { href: "/declarer/trouve", label: "J'ai trouvé" },
  { href: "/declarer/perdu", label: "J'ai perdu" },
  { href: "/#points-relais", label: "Points relais" },
];

const SHELL = "sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70";

/** En-tête statique (pré-rendu) affiché le temps que l'en-tête complet arrive. */
export function HeaderFallback() {
  return (
    <header className={SHELL}>
      <div className="mx-auto flex h-16 max-w-7xl items-center px-5 sm:px-8 lg:h-[72px]">
        <Link href="/" className="text-[22px]" aria-label="Orea, accueil">
          <Logo />
        </Link>
      </div>
    </header>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await logout();
    router.push("/");
  };

  return (
    <header className={SHELL}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-highlight focus:px-4 focus:py-2 focus:font-semibold focus:text-highlight-foreground"
      >
        Aller au contenu
      </a>
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-5 sm:px-8 lg:h-[72px] lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="w-fit text-[22px]" aria-label="Orea, accueil">
          <Logo />
        </Link>

        {/* Navigation centrée, comme la référence */}
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-[15px] font-medium text-foreground/70 transition-colors hover:text-foreground",
                  active && "bg-muted text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-1">
          <ThemeToggle />
          {status === "authenticated" && user && <NotificationBell />}

          {status === "authenticated" && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-1 flex items-center gap-2 rounded-full p-1 pr-1 transition hover:bg-muted sm:pr-3"
                  aria-label="Mon compte"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-brand-700 font-heading text-sm font-bold text-white">
                    {user.full_name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-28 truncate text-sm font-semibold sm:inline">{user.full_name.split(" ")[0]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
                <DropdownMenuLabel className="font-normal">
                  <p className="font-semibold">{user.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-xl py-2">
                  <Link href="/tableau-de-bord"><LayoutDashboard /> Mon espace</Link>
                </DropdownMenuItem>
                {(user.role === "relay" || user.role === "admin") && (
                  <DropdownMenuItem asChild className="rounded-xl py-2">
                    <Link href="/relais"><Store /> Espace point relais</Link>
                  </DropdownMenuItem>
                )}
                {user.role === "admin" && (
                  <DropdownMenuItem asChild className="rounded-xl py-2">
                    <Link href="/admin"><ShieldCheck /> Administration</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild className="rounded-xl py-2">
                  <Link href="/tableau-de-bord?onglet=profil"><UserRound /> Mon profil</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut} className="rounded-xl py-2">
                  <LogOut /> Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Button variant="ghost" asChild>
                <Link href="/connexion">Se connecter</Link>
              </Button>
              <Button asChild>
                <Link href="/inscription">Créer un compte</Link>
              </Button>
            </div>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88vw] max-w-sm border-l-0 p-6">
              <SheetTitle className="text-2xl"><Logo /></SheetTitle>
              <nav aria-label="Navigation mobile" className="mt-10 flex flex-col">
                {[{ href: "/", label: "Accueil" }, ...NAV].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="border-b py-4 font-heading text-2xl font-bold tracking-tight transition hover:text-primary"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="mt-10 flex flex-col gap-3">
                {user ? (
                  <Button asChild size="lg" onClick={() => setOpen(false)}>
                    <Link href={homeFor(user)}>Mon espace</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg" onClick={() => setOpen(false)}>
                      <Link href="/inscription">Créer un compte</Link>
                    </Button>
                    <Button variant="outline" size="lg" asChild onClick={() => setOpen(false)}>
                      <Link href="/connexion">Se connecter</Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
