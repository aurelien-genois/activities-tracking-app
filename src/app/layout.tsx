import type { Metadata, Viewport } from "next";

import { Bitter, IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-source-sans",
  display: "swap",
});

const bitter = Bitter({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-bitter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Activities Tracking",
  description: "Log your daily activities quickly.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${sourceSans.variable} ${bitter.variable} ${plexMono.variable} min-h-dvh font-sans text-foreground antialiased`}
      >
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
