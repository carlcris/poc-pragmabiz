"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QuotationForm } from "@/components/quotations/QuotationForm";

export default function CreateQuotationPage() {
  const router = useRouter();
  const t = useTranslations("quotationForm");

  return (
    <div className="container mx-auto max-w-6xl space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("createTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("createDescription")}</p>
      </div>

      <QuotationForm
        onCancel={() => router.push("/sales/quotations")}
        onSuccess={() => router.push("/sales/quotations")}
      />
    </div>
  );
}
