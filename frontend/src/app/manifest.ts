import type { MetadataRoute } from "next";

/** Orea s'installe comme une application sur le téléphone (écran d'accueil). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orea · Pièces perdues & retrouvées",
    short_name: "Orea",
    description: "Retrouve tes pièces d'identité perdues à Abidjan.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF8F4",
    theme_color: "#0F5C47",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "J'ai trouvé une pièce", url: "/declarer/trouve" },
      { name: "J'ai perdu une pièce", url: "/declarer/perdu" },
      { name: "Mon espace", url: "/tableau-de-bord" },
    ],
  };
}
