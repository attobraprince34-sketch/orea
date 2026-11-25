import { Hero } from "@/components/landing/hero";
import {
  DocTypesMarquee,
  Faq,
  FinalCta,
  HowItWorks,
  Journeys,
  RelaySection,
  Security,
  Stats,
} from "@/components/landing/sections";

/** Landing page : tout le concept doit être compris en 3 secondes. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <DocTypesMarquee />
      <HowItWorks />
      <Journeys />
      <Security />
      <RelaySection />
      <Stats />
      <Faq />
      <FinalCta />
    </>
  );
}
