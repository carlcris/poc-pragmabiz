import type { Metadata, Viewport } from "next";
import { TabletBottomNav } from "@/components/tablet/TabletBottomNav";

export const metadata: Metadata = {
  title: "Warehouse Operations | ERP+",
  description: "Tablet warehouse operations application",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function TabletLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Tablet-optimized container - max width 768px */}
      <div className="mx-auto max-w-2xl">{children}</div>

      {/* Bottom Navigation */}
      <TabletBottomNav />
    </div>
  );
}
