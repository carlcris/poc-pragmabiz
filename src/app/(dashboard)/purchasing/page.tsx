"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PurchasingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/purchasing/suppliers");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
    </div>
  );
}
