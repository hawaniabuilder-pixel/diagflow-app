import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DemoBadge from "./components/DemoBadge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vizion",
    description: "Le diagnostic Vizion pour les PME françaises, par et pour les consultants.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Bandeau « MODE DÉMO » : visible dans l’espace de travail (tableau de bord, diagnostics) quand le mode démo est activé */}
        <DemoBadge />
        {children}
      </body>
    </html>
  );
}
