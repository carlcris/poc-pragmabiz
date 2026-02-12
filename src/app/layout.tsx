import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { Toaster } from "@/components/ui/sonner";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} overscroll-contain`}>
        <LanguageProvider>
          <UserPreferencesProvider>
            <ReactQueryProvider>
              {children}
              <Toaster richColors position="top-right" />
            </ReactQueryProvider>
          </UserPreferencesProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
