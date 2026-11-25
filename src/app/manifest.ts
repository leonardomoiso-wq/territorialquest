import type { MetadataRoute } from "next";
import { BASE } from "@/domain/palette";

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
    background_color: BASE.paper,
    theme_color: BASE.ink,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
