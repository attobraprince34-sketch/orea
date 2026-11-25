import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto px-3 pb-24 sm:px-4 lg:pb-4">
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[2rem] bg-[#0E1A16] text-[#EEF5F1]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:px-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="text-3xl" aria-label="Orea, accueil">
              <Logo inverted />
            </Link>
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-[#A6BDB3]">
              Le point de rencontre entre ceux qui trouvent et ceux qui cherchent. Fait avec soin à Abidjan.
            </p>
          </div>
          <FooterColumn
            title="Utiliser Orea"
            links={[
              ["/recherche", "Rechercher une pièce"],
              ["/declarer/trouve", "J'ai trouvé une pièce"],
              ["/declarer/perdu", "J'ai perdu une pièce"],
            ]}
          />
          <FooterColumn
            title="Découvrir"
            links={[
              ["/#comment-ca-marche", "Comment ça marche"],
              ["/#securite", "Sécurité des données"],
              ["/#points-relais", "Points relais"],
              ["/#faq", "Questions fréquentes"],
            ]}
          />
          <FooterColumn
            title="Mon compte"
            links={[
              ["/connexion", "Se connecter"],
              ["/inscription", "Créer un compte"],
              ["/tableau-de-bord", "Mon espace"],
            ]}
          />
        </div>
        {/* Grand mot-symbole décoratif, à la manière des pieds de page éditoriaux. */}
        <p aria-hidden className="display -mb-[0.22em] px-6 text-[24vw] leading-none text-white/[0.06] select-none sm:px-10 lg:text-[16rem]">
          orea
        </p>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-6 py-5 text-xs text-[#A6BDB3] sm:px-10">
            © Orea · Projet de classe · Les données affichées en démonstration sont fictives.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-4 space-y-3">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-[15px] text-[#C9DAD2] transition hover:text-[#FFA151]">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
