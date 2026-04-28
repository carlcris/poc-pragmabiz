"use client";

import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotationForm } from "@/components/quotations/QuotationForm";
import { useQuotation } from "@/hooks/useQuotations";

export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const t = useTranslations("quotationForm");
  const tCommon = useTranslations("common");
  const quotationId = typeof params.id === "string" ? params.id : "";

  const { data: quotation, isLoading, error } = useQuotation(quotationId);

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
          <h1 className="text-3xl font-bold tracking-tight">{t("editTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("editDescription")}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          {tCommon("loading")}
        </div>
      ) : error || !quotation ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-10 text-center text-destructive">
          {error instanceof Error ? error.message : "Failed to load quotation"}
        </div>
      ) : (
        <QuotationForm
          quotation={quotation}
          onCancel={() => router.push("/sales/quotations")}
          onSuccess={() => router.push("/sales/quotations")}
        />
      )}
    </div>
  );
}
