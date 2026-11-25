import type { MetadataRoute } from "next";

/** L'app si installa sulla schermata home e si apre a schermo intero. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Territorial Quest",
    short_name: "TQuest",
    description: "Ricerca sul campo cooperativa: si esplora un territorio insieme, i dati raccolti diventano una mappa viva.",
    lang: "it",
    start_url: "/entra",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ebe6d8",
    theme_color: "#2b2118",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
