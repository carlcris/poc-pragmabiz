"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  BadgeDollarSign,
  Banknote,
  Building2,
  CreditCard,
  FileText,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { useSupplier } from "@/hooks/useSuppliers";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { EditGuard } from "@/components/permissions/PermissionGuard";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusText } from "@/components/shared/StatusText";
import { RESOURCES } from "@/constants/resources";
import type { Supplier } from "@/types/supplier";
import type { LucideIcon } from "lucide-react";

const SupplierFormDialog = dynamic(
  () => import("@/components/suppliers/SupplierFormDialog").then((mod) => mod.SupplierFormDialog),
  { ssr: false }
);

type SupplierDetailsPageProps = {
  params: Promise<{ id: string }>;
};

type DetailItemProps = {
  icon: LucideIcon;
  label: string;
  value?: React.ReactNode;
  mutedValue?: React.ReactNode;
};

const DetailItem = ({ icon: Icon, label, value, mutedValue }: DetailItemProps) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 rounded-lg bg-muted p-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="min-w-0 flex-1 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="break-words font-medium">{value || "-"}</div>
      {mutedValue ? (
        <div className="break-words text-sm text-muted-foreground">{mutedValue}</div>
      ) : null}
    </div>
  </div>
);

const formatDate = (value?: string) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
};

const formatAddress = (parts: Array<string | undefined>) => parts.filter(Boolean).join(", ") || "-";

function SupplierDetailsContent({ params }: SupplierDetailsPageProps) {
  const unwrappedParams = React.use(params);
  const supplierId = unwrappedParams.id;
  const tPage = useTranslations("suppliersPage");
  const tForm = useTranslations("supplierForm");
  const tCommon = useTranslations("common");
  const { formatCurrency } = useCurrency();
  const { data: supplier, isLoading, error } = useSupplier(supplierId);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const getStatusLabel = (status: Supplier["status"]) => {
    switch (status) {
      case "active":
        return tPage("statusActive");
      case "inactive":
        return tPage("statusInactive");
      case "blacklisted":
        return tPage("statusBlacklisted");
      default:
        return status;
    }
  };

  const getStatusBadge = (status: Supplier["status"]) => {
    const label = getStatusLabel(status);
    if (status === "active") return <StatusText tone="green">{label}</StatusText>;
    if (status === "inactive") return <StatusText tone="muted">{label}</StatusText>;
    if (status === "blacklisted") return <StatusText tone="red">{label}</StatusText>;
    return <StatusText>{label}</StatusText>;
  };

  const getPaymentTermsLabel = (terms?: string) => {
    const labels: Record<string, string> = {
      cod: tPage("paymentCod"),
      net_7: tPage("paymentNet7"),
      net_15: tPage("paymentNet15"),
      net_30: tPage("paymentNet30"),
      net_45: tPage("paymentNet45"),
      net_60: tPage("paymentNet60"),
      net_90: tPage("paymentNet90"),
    };
    return terms ? labels[terms] || terms : "-";
  };

  if (isLoading && !supplier) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title={tPage("status")} icon={ShieldCheck} isLoading />
          <MetricCard title={tPage("paymentTerms")} icon={CreditCard} isLoading />
          <MetricCard title={tPage("creditLimit")} icon={BadgeDollarSign} isLoading />
          <MetricCard title={tPage("balance")} icon={Banknote} isLoading />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {[1, 2].map((panel) => (
            <Card key={panel}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3, 4].map((row) => (
                  <Skeleton key={row} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-center">
        <div>
          <p className="mb-2 text-red-500">{tPage("loadError")}</p>
          <Button asChild>
            <Link href="/purchasing/suppliers">Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  const billingAddress = formatAddress([
    supplier.billingAddress,
    supplier.billingCity,
    supplier.billingState,
    supplier.billingPostalCode,
    supplier.billingCountry,
  ]);
  const shippingAddress = formatAddress([
    supplier.shippingAddress,
    supplier.shippingCity,
    supplier.shippingState,
    supplier.shippingPostalCode,
    supplier.shippingCountry,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{supplier.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {supplier.code} • {supplier.contactPerson} • {supplier.email}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <EditGuard resource={RESOURCES.SUPPLIERS}>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {tCommon("edit")}
            </Button>
          </EditGuard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title={tPage("status")}
          icon={ShieldCheck}
          value={getStatusLabel(supplier.status)}
        />
        <MetricCard
          title={tPage("paymentTerms")}
          icon={CreditCard}
          value={getPaymentTermsLabel(supplier.paymentTerms)}
        />
        <MetricCard
          title={tPage("creditLimit")}
          icon={BadgeDollarSign}
          value={formatCurrency(supplier.creditLimit ?? 0)}
        />
        <MetricCard
          title={tPage("balance")}
          icon={Banknote}
          value={formatCurrency(supplier.currentBalance)}
          valueClassName={
            supplier.currentBalance > 0
              ? "text-2xl font-bold text-orange-600"
              : "text-2xl font-bold"
          }
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{tForm("generalTab")}</TabsTrigger>
          <TabsTrigger value="addresses">{tForm("billingTab")}</TabsTrigger>
          <TabsTrigger value="payment">{tForm("paymentTab")}</TabsTrigger>
          <TabsTrigger value="notes">{tForm("notesLabel")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 min-h-[34rem] space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Supplier Information</CardTitle>
                <CardDescription>Primary supplier identity and contact details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailItem icon={Building2} label={tPage("code")} value={supplier.code} />
                  <DetailItem
                    icon={UserRound}
                    label={tPage("contactPerson")}
                    value={supplier.contactPerson}
                  />
                  <DetailItem
                    icon={Mail}
                    label={tForm("emailLabel").replace(" *", "")}
                    value={supplier.email}
                  />
                  <DetailItem
                    icon={Phone}
                    label={tPage("contactInfo")}
                    value={supplier.phone}
                    mutedValue={supplier.mobile}
                  />
                </div>
                <div className="border-t pt-4">
                  <DetailItem
                    icon={Globe}
                    label={tForm("websiteLabel").replace(" *", "")}
                    value={supplier.website || "-"}
                    mutedValue={
                      supplier.taxId
                        ? `${tForm("taxIdLabel").replace(" *", "")}: ${supplier.taxId}`
                        : undefined
                    }
                  />
                </div>
                <div className="border-t pt-4">
                  <DetailItem
                    icon={FileText}
                    label={tForm("notesLabel")}
                    value={supplier.notes || "-"}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Account Summary</CardTitle>
                <CardDescription>Supplier status and commercial terms.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {tPage("status")}
                  </span>
                  {getStatusBadge(supplier.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {tForm("languageLabel").replace(" *", "")}
                  </span>
                  <Badge variant="outline">{supplier.lang}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {tPage("paymentTerms")}
                  </span>
                  <Badge variant="outline">{getPaymentTermsLabel(supplier.paymentTerms)}</Badge>
                </div>
                <div className="border-t pt-4 text-sm text-muted-foreground">
                  <div>Created: {formatDate(supplier.createdAt)}</div>
                  <div>Updated: {formatDate(supplier.updatedAt)}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="addresses" className="mt-4 min-h-[34rem]">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <MapPin className="h-4 w-4" />
                  {tForm("billingTab")}
                </CardTitle>
                <CardDescription>Billing address used for supplier documents.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed">{billingAddress}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Truck className="h-4 w-4" />
                  {tForm("shippingTab")}
                </CardTitle>
                <CardDescription>Shipping address used for supplier deliveries.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed">{shippingAddress}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payment" className="mt-4 min-h-[34rem]">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Payment Terms</CardTitle>
                <CardDescription>Credit terms and outstanding balance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DetailItem
                  icon={CreditCard}
                  label={tPage("paymentTerms")}
                  value={getPaymentTermsLabel(supplier.paymentTerms)}
                />
                <DetailItem
                  icon={BadgeDollarSign}
                  label={tPage("creditLimit")}
                  value={formatCurrency(supplier.creditLimit ?? 0)}
                />
                <DetailItem
                  icon={Banknote}
                  label={tPage("balance")}
                  value={formatCurrency(supplier.currentBalance)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">{tForm("bankTab")}</CardTitle>
                <CardDescription>Bank details maintained for supplier payments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DetailItem
                  icon={Building2}
                  label={tForm("bankNameLabel")}
                  value={supplier.bankName || "-"}
                />
                <DetailItem
                  icon={ReceiptText}
                  label={tForm("bankAccountNameLabel")}
                  value={supplier.bankAccountName || "-"}
                />
                <DetailItem
                  icon={CreditCard}
                  label={tForm("bankAccountNumberLabel")}
                  value={supplier.bankAccountNumber || "-"}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4 min-h-[34rem]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{tForm("notesLabel")}</CardTitle>
              <CardDescription>Internal notes and supplier metadata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="min-h-24 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
                {supplier.notes || "-"}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  icon={FileText}
                  label="Created"
                  value={formatDate(supplier.createdAt)}
                />
                <DetailItem
                  icon={FileText}
                  label="Updated"
                  value={formatDate(supplier.updatedAt)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editOpen ? (
        <SupplierFormDialog open={editOpen} onOpenChange={setEditOpen} supplier={supplier} />
      ) : null}
    </div>
  );
}

export default function SupplierDetailsPage(props: SupplierDetailsPageProps) {
  return (
    <ProtectedRoute resource={RESOURCES.SUPPLIERS}>
      <SupplierDetailsContent {...props} />
    </ProtectedRoute>
  );
}
