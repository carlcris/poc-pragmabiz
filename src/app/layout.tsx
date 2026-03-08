import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { Toaster } from "@/components/ui/sonner";
import { defaultLocale, localeCookieName, locales, type Locale } from "@/lib/i18n";
import { translations } from "@/lib/i18n/translations";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Achlers Integrated Sales - Inventory Management System",
  description: "Enterprise Resource Planning System for Sales and Inventory Management",
  icons: {
    icon: "/achlers_circle.png",
    shortcut: "/achlers_circle.png",
    apple: "/achlers_circle.png",
  },
};

const isLocale = (value: string): value is Locale => {
  return locales.includes(value as Locale);
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeValue = cookieStore.get(localeCookieName)?.value;
  const locale = localeValue && isLocale(localeValue) ? localeValue : defaultLocale;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.className} overscroll-contain`}>
        <NextIntlClientProvider locale={locale} messages={translations[locale]}>
          <UserPreferencesProvider>
            <ReactQueryProvider>
              {children}
              <Toaster richColors position="top-right" />
            </ReactQueryProvider>
          </UserPreferencesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
