"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SalesOrderForm } from "@/components/sales-orders/SalesOrderForm";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreateSalesOrderPage() {
  const router = useRouter();
  const t = useTranslations("salesOrderForm");

  return (
    <div className="container mx-auto max-w-6xl space-y-6 pb-10">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/sales/orders")}
          className="-ml-2 mb-1 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          {t("back")}
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{t("createTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("createDescription")}</p>
      </div>

      <SalesOrderForm
        onCancel={() => router.push("/sales/orders")}
        onSuccess={() => router.push("/sales/orders")}
      />
    </div>
  );
}
