import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "./components/TopNav";
import { ThemeProvider, THEME_INIT_SCRIPT } from "./components/ThemeProvider";
import { LanguageProvider } from "./components/LanguageProvider";
import { getSession } from "@/lib/auth";
import { getUserLocale } from "@/lib/getLocale";
import { DEFAULT_LOCALE } from "@/lib/i18n";

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
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased direction-rtl`}
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
            <TopNav />
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
