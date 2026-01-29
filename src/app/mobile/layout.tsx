import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/mobile/BottomNav";

export const metadata: Metadata = {
  title: "Van Sales | ERP+",
  description: "Mobile van sales application",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Mobile-optimized container - max width for phone/tablet */}
      <div className="mx-auto max-w-md">{children}</div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
