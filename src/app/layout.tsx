import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Activities Tracking",
  description: "Log your daily activities quickly.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Exposes env(safe-area-inset-*) so the fixed Save bar clears the home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
