"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotationForm } from "@/components/quotations/QuotationForm";

export default function CreateQuotationPage() {
  const router = useRouter();
  const t = useTranslations("quotationForm");

  return (
    <div className="container mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/sales/quotations")}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{t("createTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("createDescription")}</p>
        </div>
      </div>

      <QuotationForm
        onCancel={() => router.push("/sales/quotations")}
        onSuccess={() => router.push("/sales/quotations")}
      />
    </div>
  );
}
