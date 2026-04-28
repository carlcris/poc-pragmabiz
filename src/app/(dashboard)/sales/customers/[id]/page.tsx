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
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { useCustomer } from "@/hooks/useCustomers";
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
import type { Customer, PaymentTerms } from "@/types/customer";
import type { LucideIcon } from "lucide-react";

const CustomerFormDialog = dynamic(
  () => import("@/components/customers/CustomerFormDialog").then((mod) => mod.CustomerFormDialog),
  { ssr: false }
);

type CustomerDetailsPageProps = {
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
      {mutedValue ? <div className="break-words text-sm text-muted-foreground">{mutedValue}</div> : null}
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

function CustomerDetailsContent({ params }: CustomerDetailsPageProps) {
  const unwrappedParams = React.use(params);
  const customerId = unwrappedParams.id;
  const tPage = useTranslations("customersPage");
  const tForm = useTranslations("customerForm");
  const tCommon = useTranslations("common");
  const { formatCurrency } = useCurrency();
  const { data: customer, isLoading, error } = useCustomer(customerId);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const getCustomerTypeLabel = (type: Customer["customerType"]) => {
    switch (type) {
      case "company":
        return tPage("typeCompany");
      case "government":
        return tPage("typeGovernment");
      default:
        return tPage("typeIndividual");
    }
  };

  const getStatusLabel = (isActive: boolean) =>
    isActive ? tCommon("active") : tCommon("inactive");

  const getPaymentTermsLabel = (terms?: PaymentTerms) => {
    const labels: Record<PaymentTerms, string> = {
      cash: tForm("paymentCash"),
      due_on_receipt: tForm("paymentDueOnReceipt"),
      net_30: tForm("paymentNet30"),
      net_60: tForm("paymentNet60"),
      net_90: tForm("paymentNet90"),
      cod: tForm("paymentCod"),
    };
    return terms ? labels[terms] : "-";
  };

  if (isLoading && !customer) {
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
          <MetricCard title={tCommon("status")} icon={ShieldCheck} isLoading />
          <MetricCard title={tForm("customerType")} icon={Building2} isLoading />
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

  if (error || !customer) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-center">
        <div>
          <p className="mb-2 text-red-500">{tPage("loadError")}</p>
          <Button asChild>
            <Link href="/sales/customers">Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  const billingAddress = formatAddress([
    customer.billingAddress,
    customer.billingCity,
    customer.billingState,
    customer.billingPostalCode,
    customer.billingCountry,
  ]);
  const shippingAddress = formatAddress([
    customer.shippingAddress,
    customer.shippingCity,
    customer.shippingState,
    customer.shippingPostalCode,
    customer.shippingCountry,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{customer.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {customer.code} • {customer.email} • {customer.phone}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <EditGuard resource={RESOURCES.CUSTOMERS}>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {tCommon("edit")}
            </Button>
          </EditGuard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title={tCommon("status")} icon={ShieldCheck} value={getStatusLabel(customer.isActive)} />
        <MetricCard
          title={tForm("customerType")}
          icon={Building2}
          value={getCustomerTypeLabel(customer.customerType)}
        />
        <MetricCard
          title={tPage("creditLimit")}
          icon={BadgeDollarSign}
          value={formatCurrency(customer.creditLimit ?? 0)}
        />
        <MetricCard
          title={tPage("balance")}
          icon={Banknote}
          value={formatCurrency(customer.currentBalance)}
          valueClassName={
            customer.currentBalance > 0 ? "text-2xl font-bold text-orange-600" : "text-2xl font-bold"
          }
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{tForm("generalTab")}</TabsTrigger>
          <TabsTrigger value="addresses">{tForm("billingTab")}</TabsTrigger>
          <TabsTrigger value="payment">{tForm("termsTab")}</TabsTrigger>
          <TabsTrigger value="notes">{tForm("notes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 min-h-[34rem] space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Customer Information</CardTitle>
                <CardDescription>Primary customer identity and contact details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailItem icon={Building2} label={tForm("customerCode")} value={customer.code} />
                  <DetailItem
                    icon={UserRound}
                    label={tForm("customerType")}
                    value={getCustomerTypeLabel(customer.customerType)}
                  />
                  <DetailItem icon={Mail} label={tForm("email")} value={customer.email} />
                  <DetailItem
                    icon={Phone}
                    label={tForm("phone")}
                    value={customer.phone}
                    mutedValue={customer.mobile}
                  />
                </div>
                <div className="border-t pt-4">
                  <DetailItem
                    icon={Globe}
                    label={tForm("website")}
                    value={customer.website || "-"}
                    mutedValue={customer.taxId ? `${tForm("taxId")}: ${customer.taxId}` : undefined}
                  />
                </div>
                <div className="border-t pt-4">
                  <DetailItem icon={FileText} label={tForm("notes")} value={customer.notes || "-"} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Account Summary</CardTitle>
                <CardDescription>Customer status and commercial terms.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{tCommon("status")}</span>
                  <StatusText tone={customer.isActive ? "green" : "muted"}>
                    {getStatusLabel(customer.isActive)}
                  </StatusText>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{tForm("customerType")}</span>
                  <Badge variant="outline">{getCustomerTypeLabel(customer.customerType)}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{tForm("paymentTerms")}</span>
                  <Badge variant="outline">{getPaymentTermsLabel(customer.paymentTerms)}</Badge>
                </div>
                <div className="border-t pt-4 text-sm text-muted-foreground">
                  <div>Created: {formatDate(customer.createdAt)}</div>
                  <div>Updated: {formatDate(customer.updatedAt)}</div>
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
                <CardDescription>Billing address used for customer documents.</CardDescription>
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
                <CardDescription>Shipping address used for customer deliveries.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed">{shippingAddress}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payment" className="mt-4 min-h-[34rem]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{tForm("paymentTerms")}</CardTitle>
              <CardDescription>Credit terms and outstanding customer balance.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem
                icon={CreditCard}
                label={tForm("paymentTerms")}
                value={getPaymentTermsLabel(customer.paymentTerms)}
              />
              <DetailItem
                icon={BadgeDollarSign}
                label={tPage("creditLimit")}
                value={formatCurrency(customer.creditLimit ?? 0)}
              />
              <DetailItem
                icon={Banknote}
                label={tPage("balance")}
                value={formatCurrency(customer.currentBalance)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4 min-h-[34rem]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{tForm("notes")}</CardTitle>
              <CardDescription>Internal notes and customer metadata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="min-h-24 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
                {customer.notes || "-"}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem icon={FileText} label="Created" value={formatDate(customer.createdAt)} />
                <DetailItem icon={FileText} label="Updated" value={formatDate(customer.updatedAt)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editOpen ? (
        <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      ) : null}
    </div>
  );
}

export default function CustomerDetailsPage(props: CustomerDetailsPageProps) {
  return (
    <ProtectedRoute resource={RESOURCES.CUSTOMERS}>
      <CustomerDetailsContent {...props} />
    </ProtectedRoute>
  );
}
