import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "./components/TopNav";
import EmailVerificationBanner from "./components/EmailVerificationBanner";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import DevEnvBadge from "./components/DevEnvBadge";
import FinanceAgent from "./components/FinanceAgent";
import { ThemeProvider, THEME_INIT_SCRIPT } from "./components/ThemeProvider";
import { LanguageProvider } from "./components/LanguageProvider";
import { getSession } from "@/lib/auth";
import { getUserLocale } from "@/lib/getLocale";
import { DEFAULT_LOCALE, dirFor } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WealthOS - Personal Wealth Management",
  description:
    "A comprehensive personal wealth management application to track, analyze, and optimize your finances.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wealth OS",
  },
};

// themeColor/viewport vivent dans un export séparé depuis Next 14+ (plus
// dans `metadata`) — voir https://nextjs.org/docs/app/api-reference/functions/generate-viewport.
export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const initialLocale = session
    ? await getUserLocale(session.userId)
    : DEFAULT_LOCALE;

  return (
    <html
      lang={initialLocale}
      dir={dirFor(initialLocale)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-flash : applique la bonne classe .dark sur <html> avant le
            premier paint, en lisant le choix stocké (ou la préférence
            système), pour éviter un flash du mauvais thème au chargement. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="flex flex-col min-h-full bg-page text-body"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <LanguageProvider
            initialLocale={initialLocale}
            authenticated={Boolean(session)}
          >
            <ServiceWorkerRegister />
            <DevEnvBadge />
            <TopNav />
            <EmailVerificationBanner />
            {children}
            <FinanceAgent />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
