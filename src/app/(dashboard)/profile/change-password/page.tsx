"use client";

import { useTranslations } from "next-intl";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";

export default function ChangePasswordPage() {
  const t = useTranslations("changePasswordPage");

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
