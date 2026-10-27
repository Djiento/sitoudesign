
import type { Metadata } from "next";
import Script from "next/script";
import PWARegister from "@/components/pwa/PWARegister";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sitou Design — Impression & Communication visuelle",
    template: "%s | Sitou Design",
  },
  description:
    "Sitou Design accompagne les entreprises et les particuliers dans leurs projets d'impression, de signalétique, de textile personnalisé et de communication visuelle.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>){
  return (
    <html lang="fr" data-scroll-behavior="smooth" data-theme="sitou" suppressHydrationWarning>
      <body>
        <PWARegister />
        <Script id="sitou-admin-theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const preference = localStorage.getItem("sitou-admin-theme");
              const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              const dark = preference === "dark" || (preference !== "light" && systemDark);
              document.documentElement.dataset.adminTheme = dark ? "dark" : "light";
            } catch {
              document.documentElement.dataset.adminTheme =
                window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            }
          })();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
