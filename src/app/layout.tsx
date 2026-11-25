import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "./ServiceWorker";

export const metadata: Metadata = {
  title: { default: "Territorial Quest", template: "%s – Territorial Quest" },
  description:
    "Ricerca sul campo cooperativa: si esplora un territorio insieme, i dati raccolti diventano una mappa viva.",
  // su iPhone, aggiunta alla schermata home, si apre a schermo intero
  appleWebApp: { capable: true, title: "TQuest", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#2b2118",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it">
      <body>{children}<ServiceWorker /></body>
    </html>
  );
}
