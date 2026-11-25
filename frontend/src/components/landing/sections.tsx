"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  Camera,
  EyeOff,
  Fingerprint,
  QrCode,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { Mascot } from "@/components/brand/mascot";
import { AnimatedCounter, Reveal } from "@/components/common/motion";
import { DocCard, HoloCard } from "@/components/illustrations/id-cards";
import { MatchIllustration, PickupIllustration, ShieldIllustration, SnapIllustration } from "@/components/illustrations/steps";
import { RelayMap } from "@/components/map/relay-map";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowBadge, Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { DocType, PublicStats } from "@/lib/types";
import { cn } from "@/lib/utils";

function SectionTitle({
  eyebrow,
  title,
  intro,
  id,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: string;
  id?: string;
  align?: "center" | "left";
}) {
  return (
    <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="display mt-4 text-4xl sm:text-5xl lg:text-6xl">{title}</h2>
      {intro && <p className="mt-5 text-lg text-muted-foreground">{intro}</p>}
    </Reveal>
  );
}

/* ---------------------------------------------------------------------------
 * 2. Carrousel défilant des pièces acceptées (illustrations aux couleurs d'Orea)
 * ------------------------------------------------------------------------- */
const ACCEPTED: { type: DocType; label: string }[] = [
  { type: "cni", label: "Carte nationale d'identité" },
  { type: "passeport", label: "Passeport" },
  { type: "permis", label: "Permis de conduire" },
  { type: "carte_etudiant", label: "Carte d'étudiant" },
  { type: "carte_grise", label: "Carte grise" },
  { type: "attestation", label: "Attestation d'identité" },
];

export function DocTypesMarquee() {
  const items = [...ACCEPTED, ...ACCEPTED];
  return (
    <section aria-labelledby="accepted-title" className="relative overflow-hidden py-14 lg:py-20">
      <div className="mx-auto max-w-7xl px-5 text-center sm:px-8">
        <p className="eyebrow">Pièces acceptées</p>
        <h2 id="accepted-title" className="display mt-4 text-3xl sm:text-5xl">
          Toutes tes pièces d&apos;identité sont les bienvenues.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Fais bouger une carte avec ta souris ou ton doigt. Ce sont des illustrations : aucune vraie pièce n&apos;est jamais affichée.
        </p>
      </div>
      <ul className="sr-only">
        {ACCEPTED.map((d) => <li key={d.label}>{d.label}</li>)}
      </ul>
      <div className="relative mt-12 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max animate-marquee items-end gap-10 py-6 hover:[animation-play-state:paused] sm:gap-14" aria-hidden>
          {items.map(({ type, label }, index) => (
            <figure key={index} className={cn("flex shrink-0 flex-col items-center", index % 2 ? "rotate-[3deg]" : "-rotate-[3deg]")}>
              <HoloCard type={type} className={type === "passeport" ? "h-56 sm:h-64" : "h-40 sm:h-48"} />
              <figcaption className="mt-5 rounded-full bg-card px-4 py-1.5 text-sm font-semibold shadow-[var(--shadow-card)] ring-1 ring-border">
                {label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 3. Comment ça marche
 * ------------------------------------------------------------------------- */
const STEPS = [
  {
    title: "Photographie la pièce",
    text: "Orea lit les informations et floute automatiquement les données sensibles.",
    Illustration: SnapIllustration,
    shape: "rounded-full bg-highlight",
  },
  {
    title: "Orea fait le lien",
    text: "Le propriétaire est prévenu, même si son nom est mal écrit ou ses prénoms inversés.",
    Illustration: MatchIllustration,
    shape: "shape-leaf-r bg-brand-200",
  },
  {
    title: "Récupère avec ton QR",
    text: "Un QR code unique, présenté au point relais. C'est réglé en deux minutes.",
    Illustration: PickupIllustration,
    shape: "shape-arch bg-glow-200",
  },
];

export function HowItWorks() {
  return (
    <section id="comment-ca-marche" aria-labelledby="how-title" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 lg:py-32">
      <SectionTitle eyebrow="Comment ça marche" id="how-title" title="Trois étapes, zéro prise de tête." />
      <ol className="mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
        {STEPS.map(({ title, text, Illustration, shape }, index) => (
          <Reveal key={title} delay={index * 0.1}>
            <li className="group">
              <div className={cn("relative mx-auto grid aspect-[1.15] w-full place-items-center transition-transform duration-500 group-hover:-translate-y-1", shape)}>
                <Illustration className="w-[72%] text-[#0E1A16]" />
                <span className="absolute -top-3 -left-1 grid size-12 place-items-center rounded-full bg-ink font-heading text-lg font-bold text-ink-foreground">
                  {index + 1}
                </span>
              </div>
              <h3 className="mt-7 text-2xl font-bold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{text}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 4. Les deux parcours (bento)
 * ------------------------------------------------------------------------- */
export function Journeys() {
  return (
    <section aria-labelledby="journeys-title" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-32">
      <SectionTitle eyebrow="Deux parcours" id="journeys-title" title="Tu as perdu, ou tu as trouvé ?" />
      <div className="mt-14 grid gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <article className="relative flex h-full min-h-[440px] flex-col overflow-hidden rounded-[2.25rem] bg-[#0E1A16] p-8 text-white sm:p-11">
            <span className="w-fit rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold">J&apos;ai perdu</span>
            <h3 className="display mt-6 max-w-md text-4xl sm:text-5xl">Déclare une fois. Orea veille pour toi.</h3>
            <ul className="mt-8 space-y-4 text-[#C9DAD2]">
              {[
                [BellRing, "Alerte par e-mail dès qu'une pièce correspond."],
                [Fingerprint, "Tu prouves que c'est la tienne avec son numéro."],
                [QrCode, "QR code de retrait valable 14 jours."],
              ].map(([Icon, text]) => {
                const I = Icon as typeof BellRing;
                return (
                  <li key={text as string} className="flex items-center gap-3">
                    <I className="size-5 shrink-0 text-glow-400" /> {text as string}
                  </li>
                );
              })}
            </ul>
            <Button asChild variant="highlight" size="lg" className="mt-auto w-fit">
              <Link href="/declarer/perdu">Déclarer une perte <ArrowBadge /></Link>
            </Button>
            <span className="absolute -right-16 -bottom-16 size-64 rounded-full bg-brand-700/60" aria-hidden />
            <Mascot mood="search" className="absolute right-4 bottom-4 hidden h-36 sm:block" />
          </article>
        </Reveal>

        <div className="grid gap-4 lg:col-span-5">
          <Reveal delay={0.08}>
            <article className="relative h-full overflow-hidden rounded-[2.25rem] bg-highlight p-8 text-[#0E1A16] sm:p-10">
              <span className="w-fit rounded-full bg-[#0E1A16]/10 px-3.5 py-1.5 text-sm font-semibold">J&apos;ai trouvé</span>
              <h3 className="display mt-5 text-3xl sm:text-4xl">Une photo, un relais, une bonne action.</h3>
              <Button asChild className="mt-7">
                <Link href="/declarer/trouve"><Camera /> Déclarer une pièce</Link>
              </Button>
              <span className="shape-quarter absolute -right-6 -bottom-6 size-32 bg-glow-300" aria-hidden />
              <div aria-hidden className="absolute -right-8 -bottom-6 hidden h-32 rotate-[-14deg] sm:block">
                <DocCard type="permis" className="h-full" />
              </div>
            </article>
          </Reveal>
          <div className="grid grid-cols-2 gap-4">
            <Reveal delay={0.12}>
              <Link href="/recherche" className="surface surface-hover flex h-full flex-col justify-between p-6">
                <Search className="size-7 text-primary" />
                <span>
                  <span className="mt-6 block font-heading text-lg font-bold">Recherche publique</span>
                  <span className="text-sm text-muted-foreground">Initiales seulement</span>
                </span>
              </Link>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="shape-leaf flex h-full flex-col justify-end bg-brand-200 p-6 text-[#0E1A16]">
                <p className="display text-5xl">0 F</p>
                <p className="mt-1 font-semibold">100 % gratuit</p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 5. Sécurité
 * ------------------------------------------------------------------------- */
const SECURITY = [
  { icon: Fingerprint, title: "Numéro jamais stocké", text: "Seule une empreinte chiffrée est conservée. Même nous ne pouvons pas relire ton numéro." },
  { icon: EyeOff, title: "Photos floutées", text: "Nom, dates, numéro et visage sont floutés. L'original est supprimé immédiatement." },
  { icon: QrCode, title: "QR à usage unique", text: "Unique, valable 14 jours, utilisable une seule fois et au bon point relais." },
  { icon: ShieldCheck, title: "Anti-abus", text: "5 numéros erronés et la réclamation est bloquée 24 h. La recherche n'affiche que des initiales." },
];

export function Security() {
  return (
    <section id="securite" aria-labelledby="security-title" className="scroll-mt-24 px-3 sm:px-4">
      <div className="mx-auto max-w-[1400px] rounded-[2.5rem] bg-brand-700 px-5 py-20 text-white sm:px-8 lg:py-28 dark:bg-brand-900">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <ShieldIllustration className="h-44 w-auto text-[#0E1A16]" />
            <p className="eyebrow mt-8 text-glow-300">Sécurité</p>
            <h2 id="security-title" className="display mt-4 text-4xl sm:text-5xl lg:text-6xl">Tes données restent à toi.</h2>
            <p className="mt-5 max-w-md text-lg text-[#C9E9DC]">
              Une pièce d&apos;identité, c&apos;est sensible. Orea est pensé pour qu&apos;une fuite ne révèle rien d&apos;exploitable.
            </p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {SECURITY.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} delay={index * 0.07}>
                <article className="h-full rounded-[1.75rem] bg-white/[0.08] p-6 ring-1 ring-white/10 backdrop-blur">
                  <span className="grid size-12 place-items-center rounded-full bg-highlight text-[#0E1A16]">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-1.5 text-[15px] text-[#C9E9DC]">{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 6. Carte des points relais
 * ------------------------------------------------------------------------- */
export function RelaySection() {
  return (
    <section id="points-relais" aria-labelledby="relays-title" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 lg:py-32">
      <SectionTitle
        eyebrow="Points relais"
        id="relays-title"
        title="Toujours un relais près de chez toi."
        intro="Six points relais dans les communes d'Abidjan. Touche une épingle pour voir l'adresse et les horaires."
      />
      <Reveal className="mt-14">
        <RelayMap />
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 7. Statistiques animées (alimentées par l'API)
 * ------------------------------------------------------------------------- */
export function Stats() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => api<PublicStats>("/stats/public"),
  });

  const items = data
    ? [
        { value: data.documents_found, label: "pièces signalées", className: "bg-[#0E1A16] text-white shape-leaf-r" },
        { value: data.documents_returned, label: "pièces rendues", className: "bg-highlight text-[#0E1A16] rounded-full" },
        { value: data.success_rate, label: "taux de réussite", suffix: " %", className: "bg-brand-200 text-[#0E1A16] shape-leaf" },
        { value: data.relay_points, label: "points relais", className: "bg-glow-200 text-[#0E1A16] shape-arch" },
      ]
    : [];

  return (
    <section aria-labelledby="stats-title" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-32">
      <SectionTitle eyebrow="En chiffres" id="stats-title" title="Chaque pièce rendue compte." />
      <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isPending && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-[2rem]" />)}
        {isError && <p className="col-span-full text-center text-muted-foreground">Statistiques indisponibles pour le moment.</p>}
        {items.map((item, index) => (
          <Reveal key={item.label} delay={index * 0.06}>
            <div className={cn("flex aspect-square flex-col items-center justify-center p-6 text-center", item.className)}>
              <p className="display text-5xl sm:text-6xl">
                <AnimatedCounter value={item.value} suffix={item.suffix ?? ""} />
              </p>
              <p className="mt-2 text-sm font-semibold opacity-80 sm:text-base">{item.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 8. FAQ + appel à l'action final
 * ------------------------------------------------------------------------- */
const FAQ = [
  ["C'est vraiment gratuit ?", "Oui, totalement. Déclarer une perte, signaler une pièce trouvée et la récupérer ne coûte rien."],
  ["Comment Orea sait que la pièce est bien à moi ?", "Pour réclamer une pièce, tu saisis son numéro. Orea compare son empreinte chiffrée avec celle de la pièce trouvée : sans le bon numéro, pas de QR code."],
  ["Et si mon nom est mal orthographié ?", "Pas de souci : les fautes de frappe, les accents oubliés et les prénoms inversés sont reconnus."],
  ["Qui peut voir la photo de ma pièce ?", "Personne en public. Elle est floutée automatiquement, et seuls le point relais et l'équipe Orea y ont accès."],
  ["Et si je ne récupère pas ma pièce à temps ?", "Ton QR code expire après 14 jours. Tu peux refaire une réclamation tant que la pièce est au point relais."],
  ["J'ai trouvé une pièce, je dois la garder ?", "Non. Tu la déposes au point relais choisi, qui confirme la réception et s'occupe de la remise."],
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto grid max-w-7xl scroll-mt-24 gap-12 px-5 pb-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:pb-32">
      <SectionTitle eyebrow="FAQ" id="faq-title" title="Tes questions, nos réponses." align="left" />
      <Reveal>
        <Accordion type="single" collapsible className="border-t">
          {FAQ.map(([question, answer], index) => (
            <AccordionItem key={question} value={`q${index}`} className="border-b">
              <AccordionTrigger className="py-6 text-left font-heading text-lg font-semibold hover:no-underline">
                {question}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-base text-muted-foreground">{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-3 pb-6 sm:px-4">
      <Reveal className="mx-auto max-w-[1400px]">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-highlight px-6 py-16 text-[#0E1A16] sm:px-12 lg:py-24">
          <div className="relative z-10 max-w-2xl">
            <h2 className="display text-4xl sm:text-6xl">Une pièce perdue n&apos;est pas une pièce disparue.</h2>
            <p className="mt-5 max-w-lg text-lg text-[#0E1A16]/75">
              Rejoins Orea en 30 secondes. Et si un jour tu trouves une pièce, tu sauras quoi faire.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="xl">
                <Link href="/inscription">Créer mon compte <ArrowBadge /></Link>
              </Button>
              <Button asChild size="xl" variant="ghost" className="hover:bg-[#0E1A16]/10">
                <Link href="/declarer/trouve"><Camera /> J&apos;ai trouvé une pièce</Link>
              </Button>
            </div>
          </div>
          <span className="absolute -top-10 right-[22%] hidden size-24 rounded-full border-[3px] border-[#0E1A16] md:block" aria-hidden />
          <span className="shape-leaf absolute -right-10 -bottom-10 hidden size-72 bg-glow-300 md:block" aria-hidden />
          <Mascot mood="party" className="absolute right-6 bottom-6 hidden h-52 md:block lg:right-16" />
        </div>
      </Reveal>
    </section>
  );
}
