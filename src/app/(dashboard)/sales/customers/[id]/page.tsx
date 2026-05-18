"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  Building2,
  CheckCircle,
  Clock,
  ClipboardList,
  CreditCard,
  Filter,
  FileText,
  Globe,
  Mail,
  MapPin,
  MoreVertical,
  Package,
  Pencil,
  Phone,
  Receipt,
  Search,
  Send,
  ShoppingCart,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCustomer, useCustomerLedger } from "@/hooks/useCustomers";
import { useCurrency } from "@/hooks/useCurrency";
import { useChangeQuotationStatus, useConfirmQuotation, useQuotations } from "@/hooks/useQuotations";
import {
  useCancelOrder,
  useConfirmOrder,
  useConvertToInvoice,
  useCreateFrameJobOrder,
  useSalesOrders,
} from "@/hooks/useSalesOrders";
import { useWarehouses } from "@/hooks/useWarehouses";
import { quotationsApi } from "@/lib/api/quotations";
import { apiClient } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerLedgerTab } from "@/components/customers/CustomerLedgerTab";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { CreateGuard, EditGuard } from "@/components/permissions/PermissionGuard";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusText } from "@/components/shared/StatusText";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { RESOURCES } from "@/constants/resources";
import type { Customer, PaymentTerms } from "@/types/customer";
import type { Quotation, QuotationStatus } from "@/types/quotation";
import type { SalesOrder, SalesOrderStatus } from "@/types/sales-order";
import type { SalesOrderFormInitialValues } from "@/components/sales-orders/SalesOrderForm";
import type { WarehouseLocation } from "@/types/inventory-location";
import type { LucideIcon } from "lucide-react";

const CustomerFormDialog = dynamic(
  () => import("@/components/customers/CustomerFormDialog").then((mod) => mod.CustomerFormDialog),
  { ssr: false }
);

const QuotationViewDialog = dynamic(
  () =>
    import("@/components/quotations/QuotationViewDialog").then((mod) => mod.QuotationViewDialog),
  { ssr: false }
);

const SalesOrderFormDialog = dynamic(
  () =>
    import("@/components/sales-orders/SalesOrderFormDialog").then(
      (mod) => mod.SalesOrderFormDialog
    ),
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

function CustomerDetailsContent({ params }: CustomerDetailsPageProps) {
  const unwrappedParams = React.use(params);
  const customerId = unwrappedParams.id;
  const locale = useLocale();
  const tPage = useTranslations("customersPage");
  const tForm = useTranslations("customerForm");
  const tCommon = useTranslations("common");
  const tQuotations = useTranslations("quotationsPage");
  const tOrders = useTranslations("salesOrdersPage");
  const { formatCurrency } = useCurrency();
  const router = useRouter();
  const { data: customer, isLoading, error } = useCustomer(customerId);
  const { data: accountSummaryData, isLoading: isAccountSummaryLoading } = useCustomerLedger(
    customerId,
    {
      limit: 1,
      enabled: !!customer,
    }
  );
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [quotationCursor, setQuotationCursor] = useState<string | null>(null);
  const [customerQuotations, setCustomerQuotations] = useState<Quotation[]>([]);
  const [quotationViewOpen, setQuotationViewOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [salesOrderDialogOpen, setSalesOrderDialogOpen] = useState(false);
  const [salesOrderInitialValues, setSalesOrderInitialValues] =
    useState<SalesOrderFormInitialValues | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [quotationToConfirm, setQuotationToConfirm] = useState<Quotation | null>(null);
  const [salesOrderSearch, setSalesOrderSearch] = useState("");
  const [salesOrderPage, setSalesOrderPage] = useState(1);
  const [salesOrderPageSize, setSalesOrderPageSize] = useState(10);
  const [salesOrderStatusFilter, setSalesOrderStatusFilter] = useState<string>("all");
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<SalesOrder | null>(null);
  const [salesOrderDialogMode, setSalesOrderDialogMode] = useState<"view" | "edit">("view");
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [orderToInvoice, setOrderToInvoice] = useState<SalesOrder | null>(null);
  const [orderToCreateJobOrder, setOrderToCreateJobOrder] = useState<SalesOrder | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<SalesOrder | null>(null);
  const changeStatus = useChangeQuotationStatus();
  const confirmQuotation = useConfirmQuotation();
  const confirmOrder = useConfirmOrder();
  const convertToInvoice = useConvertToInvoice();
  const createFrameJobOrder = useCreateFrameJobOrder();
  const cancelOrder = useCancelOrder();

  const {
    data: quotationsData,
    isLoading: isQuotationsLoading,
    isFetching: isQuotationsFetching,
    error: quotationsError,
  } = useQuotations({
    customerId,
    cursor: quotationCursor,
    limit: 10,
  });

  const {
    data: salesOrdersData,
    isLoading: isSalesOrdersLoading,
    error: salesOrdersError,
  } = useSalesOrders({
    customerId,
    search: salesOrderSearch,
    status: salesOrderStatusFilter as SalesOrderStatus | "all",
    page: salesOrderPage,
    limit: salesOrderPageSize,
  });

  const customerSalesOrders = salesOrdersData?.data || [];
  const salesOrderPagination = salesOrdersData?.pagination;
  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const warehouses = warehousesData?.data || [];

  const { data: locationsData } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedWarehouse],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedWarehouse}/locations`),
    enabled: !!selectedWarehouse,
  });

  const locations = React.useMemo(
    () => (locationsData?.data || []).filter((location) => location.isActive),
    [locationsData]
  );

  React.useEffect(() => {
    setQuotationCursor(null);
    setCustomerQuotations([]);
  }, [customerId]);

  React.useEffect(() => {
    if (!quotationsData) return;

    setCustomerQuotations((current) => {
      const nextRows = quotationCursor ? [...current, ...quotationsData.data] : quotationsData.data;
      const rowsById = new Map(nextRows.map((quotation) => [quotation.id, quotation]));
      return Array.from(rowsById.values());
    });
  }, [quotationCursor, quotationsData]);

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

  const getQuotationStatus = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return <StatusText tone="muted">{tQuotations("draft")}</StatusText>;
      case "sent":
        return <StatusText tone="blue">{tQuotations("sent")}</StatusText>;
      case "accepted":
        return <StatusText tone="green">{tQuotations("accepted")}</StatusText>;
      case "partially_ordered":
        return <StatusText tone="yellow">{tQuotations("partiallyOrdered")}</StatusText>;
      case "rejected":
        return <StatusText tone="red">{tQuotations("rejected")}</StatusText>;
      case "expired":
        return <StatusText tone="orange">{tQuotations("expired")}</StatusText>;
      case "ordered":
        return <StatusText tone="purple">{tQuotations("ordered")}</StatusText>;
    }
  };

  const getQuotationIcon = (status: QuotationStatus) => {
    switch (status) {
      case "sent":
        return <Send className="h-4 w-4 text-blue-600" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partially_ordered":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "ordered":
        return <ShoppingCart className="h-4 w-4 text-purple-600" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatQuotationDate = (value: string) =>
    new Date(value).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const openQuotation = async (quotation: Quotation) => {
    try {
      const fullQuotation = await quotationsApi.getQuotation(quotation.id);
      setSelectedQuotation(fullQuotation);
      setQuotationViewOpen(true);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load quotation details";
      setSelectedQuotation(null);
      setQuotationViewOpen(false);
      console.error(message);
    }
  };

  const handleEditQuotation = (quotation: Quotation) => {
    router.push(`/sales/quotations/${quotation.id}/edit`);
  };

  const canChangeQuotationStatus = (status: QuotationStatus) => {
    return status === "draft" || status === "sent";
  };

  const getAvailableQuotationStatuses = (currentStatus: QuotationStatus) => {
    const statuses = [];

    if (currentStatus === "draft") {
      statuses.push({ value: "sent", label: tQuotations("markAsSent"), icon: Send });
      statuses.push({ value: "accepted", label: tQuotations("markAsAccepted"), icon: CheckCircle });
      statuses.push({ value: "rejected", label: tQuotations("markAsRejected"), icon: XCircle });
    } else if (currentStatus === "sent") {
      statuses.push({ value: "accepted", label: tQuotations("markAsAccepted"), icon: CheckCircle });
      statuses.push({ value: "rejected", label: tQuotations("markAsRejected"), icon: XCircle });
    }

    return statuses;
  };

  const handleChangeQuotationStatus = async (quotation: Quotation, newStatus: string) => {
    if (newStatus === "accepted") {
      setQuotationToConfirm(quotation);
      setConfirmDialogOpen(true);
      return;
    }

    try {
      await changeStatus.mutateAsync({ id: quotation.id, status: newStatus });
      toast.success("Quotation status updated successfully");
    } catch (statusError) {
      toast.error(
        statusError instanceof Error ? statusError.message : "Failed to update quotation status"
      );
    }
  };

  const handleConfirmQuotation = async () => {
    if (!quotationToConfirm) return;

    try {
      await confirmQuotation.mutateAsync({
        id: quotationToConfirm.id,
        warehouseId: null,
      });
      toast.success("Quotation confirmed");
      setConfirmDialogOpen(false);
      setQuotationToConfirm(null);
    } catch (confirmError) {
      toast.error(
        confirmError instanceof Error ? confirmError.message : "Failed to confirm quotation"
      );
    }
  };

  const handleCreateSalesOrder = () => {
    if (!customer) return;

    setSalesOrderInitialValues({
      customerId: customer.id,
      lockCustomer: true,
      orderDate: new Date().toISOString().split("T")[0],
      expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      shippingAddress: customer.shippingAddress || customer.billingAddress,
      shippingCity: customer.shippingCity || customer.billingCity,
      shippingState: customer.shippingState || customer.billingState,
      shippingPostalCode: customer.shippingPostalCode || customer.billingPostalCode,
      shippingCountry: customer.shippingCountry || customer.billingCountry,
      paymentTerms: getPaymentTermsLabel(customer.paymentTerms),
      notes: "",
      lineItems: [],
    });
    setSalesOrderDialogOpen(true);
  };

  const getSalesOrderStatusIcon = (status: SalesOrderStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-600" />;
      case "confirmed":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "shipped":
        return <Truck className="h-4 w-4 text-purple-600" />;
      case "delivered":
        return <Package className="h-4 w-4 text-green-600" />;
      case "invoiced":
        return <Receipt className="h-4 w-4 text-indigo-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getSalesOrderStatus = (status: SalesOrderStatus) => {
    switch (status) {
      case "draft":
        return <StatusText tone="muted">{tOrders("draft")}</StatusText>;
      case "confirmed":
        return <StatusText tone="blue">{tOrders("confirmed")}</StatusText>;
      case "in_progress":
        return <StatusText tone="yellow">{tOrders("inProgress")}</StatusText>;
      case "shipped":
        return <StatusText tone="purple">{tOrders("shipped")}</StatusText>;
      case "delivered":
        return <StatusText tone="green">{tOrders("delivered")}</StatusText>;
      case "invoiced":
        return <StatusText tone="indigo">{tOrders("invoiced")}</StatusText>;
      case "cancelled":
        return <StatusText tone="red">{tOrders("cancelled")}</StatusText>;
    }
  };

  const isSalesOrderOverdue = (expectedDeliveryDate: string, status: SalesOrderStatus) => {
    if (status === "delivered" || status === "cancelled" || status === "invoiced") return false;
    return new Date(expectedDeliveryDate) < new Date();
  };

  const handleSalesOrderStatusFilterChange = (value: string) => {
    setSalesOrderStatusFilter(value);
    setSalesOrderPage(1);
  };

  const handleViewSalesOrder = (order: SalesOrder) => {
    setSelectedSalesOrder(order);
    setSalesOrderDialogMode("view");
    setSalesOrderDialogOpen(true);
  };

  const handleEditSalesOrder = (order: SalesOrder) => {
    setSelectedSalesOrder(order);
    setSalesOrderDialogMode("edit");
    setSalesOrderDialogOpen(true);
  };

  const handleConvertSalesOrderToInvoice = (order: SalesOrder) => {
    setOrderToInvoice(order);
    setOrderToCreateJobOrder(null);
    setSelectedWarehouse("");
    setSelectedLocation("");
    setWarehouseDialogOpen(true);
  };

  const handleCreateSalesOrderJobOrder = (order: SalesOrder) => {
    setOrderToCreateJobOrder(order);
    setOrderToInvoice(null);
    setSelectedWarehouse("");
    setSelectedLocation("");
    setWarehouseDialogOpen(true);
  };

  const handleConfirmInvoiceConversion = async () => {
    if (!orderToInvoice || !selectedWarehouse) return;

    try {
      await convertToInvoice.mutateAsync({
        orderId: orderToInvoice.id,
        warehouseId: selectedWarehouse,
        locationId: selectedLocation || undefined,
      });
      setWarehouseDialogOpen(false);
      router.push("/sales/invoices");
    } catch {
      // Mutation hook owns the toast.
    }
  };

  const handleConfirmJobOrderCreation = async () => {
    if (!orderToCreateJobOrder || !selectedWarehouse) return;

    try {
      const result = await createFrameJobOrder.mutateAsync({
        orderId: orderToCreateJobOrder.id,
        warehouseId: selectedWarehouse,
      });
      setWarehouseDialogOpen(false);
      router.push(`/sales/frame-job-orders/${result.frameJobOrder.id}`);
    } catch {
      // Mutation hook owns the toast.
    }
  };

  const handleConfirmSalesOrder = async (order: SalesOrder) => {
    try {
      await confirmOrder.mutateAsync(order.id);
    } catch {
      // Mutation hook owns the toast.
    }
  };

  const handleConfirmCancelSalesOrder = async () => {
    if (!orderToCancel) return;

    try {
      await cancelOrder.mutateAsync(orderToCancel.id);
      setOrderToCancel(null);
    } catch {
      // Mutation hook owns the toast.
    }
  };

  const canCreateFrameJobOrder = (order: SalesOrder) =>
    !order.frameJobOrder &&
    order.hasFrameJobEligibleItems &&
    (order.status === "confirmed" || order.status === "in_progress" || order.status === "invoiced");

  const canCancelSalesOrder = (order: SalesOrder) =>
    order.status !== "cancelled" && order.status !== "invoiced";

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
          <MetricCard title="Outstanding Balance" icon={Banknote} isLoading />
          <MetricCard title="Active Invoices" icon={FileText} isLoading />
          <MetricCard title="Overdue Invoices" icon={AlertTriangle} isLoading />
          <MetricCard title="Available Credit" icon={CreditCard} isLoading />
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
  const ledgerSummary = accountSummaryData?.summary;
  const outstandingBalance = ledgerSummary?.closingBalance ?? customer.currentBalance;
  const availableCredit = Math.max((customer.creditLimit ?? 0) - outstandingBalance, 0);

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
        <MetricCard
          title="Outstanding Balance"
          icon={Banknote}
          value={formatCurrency(outstandingBalance)}
          isLoading={isAccountSummaryLoading}
          skeletonCaption
          caption={`${ledgerSummary?.activeInvoiceCount ?? 0} active invoices`}
          valueClassName={
            outstandingBalance > 0 ? "text-2xl font-bold text-orange-600" : "text-2xl font-bold"
          }
        />
        <MetricCard
          title={tPage("creditLimit")}
          icon={BadgeDollarSign}
          value={formatCurrency(customer.creditLimit ?? 0)}
          caption={`${getPaymentTermsLabel(customer.paymentTerms)} terms`}
        />
        <MetricCard
          title="Overdue Invoices"
          icon={AlertTriangle}
          value={String(ledgerSummary?.overdueInvoiceCount ?? 0)}
          isLoading={isAccountSummaryLoading}
          caption="Requires collection follow-up"
          iconClassName={
            (ledgerSummary?.overdueInvoiceCount ?? 0) > 0
              ? "h-4 w-4 text-orange-600"
              : "h-4 w-4 text-muted-foreground"
          }
        />
        <MetricCard
          title="Available Credit"
          icon={CreditCard}
          value={formatCurrency(availableCredit)}
          isLoading={isAccountSummaryLoading}
          caption={`${formatCurrency(customer.creditLimit ?? 0)} limit`}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-border/40 bg-gradient-to-r from-background via-muted/20 to-background">
          <div className="container-fluid">
            <TabsList className="h-auto w-full justify-start gap-2 rounded-none border-b-0 bg-transparent p-0 py-2">
              <TabsTrigger
                value="overview"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <UserRound className="h-4 w-4" />
                {tForm("generalTab")}
              </TabsTrigger>
              <TabsTrigger
                value="payment"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <CreditCard className="h-4 w-4" />
                {tForm("termsTab")}
              </TabsTrigger>
              <TabsTrigger
                value="quotations"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <FileText className="h-4 w-4" />
                {tQuotations("title")}
              </TabsTrigger>
              <TabsTrigger
                value="sales-orders"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <ShoppingCart className="h-4 w-4" />
                {tOrders("title")}
              </TabsTrigger>
              <TabsTrigger
                value="ledger"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <Receipt className="h-4 w-4" />
                Ledger
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <ClipboardList className="h-4 w-4" />
                {tForm("notes")}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="overview" className="mt-4 min-h-[34rem] space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Customer Information</CardTitle>
                <CardDescription>Primary customer identity and contact details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailItem
                    icon={Building2}
                    label={tForm("customerCode")}
                    value={customer.code}
                  />
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
                  <DetailItem
                    icon={FileText}
                    label={tForm("notes")}
                    value={customer.notes || "-"}
                  />
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
                  <span className="text-sm font-medium text-muted-foreground">
                    {tCommon("status")}
                  </span>
                  <StatusText tone={customer.isActive ? "green" : "muted"}>
                    {getStatusLabel(customer.isActive)}
                  </StatusText>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {tForm("customerType")}
                  </span>
                  <Badge variant="outline">{getCustomerTypeLabel(customer.customerType)}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {tForm("paymentTerms")}
                  </span>
                  <Badge variant="outline">{getPaymentTermsLabel(customer.paymentTerms)}</Badge>
                </div>
                <div className="border-t pt-4 text-sm text-muted-foreground">
                  <div>Created: {formatDate(customer.createdAt)}</div>
                  <div>Updated: {formatDate(customer.updatedAt)}</div>
                </div>
              </CardContent>
            </Card>
          </div>

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

        <TabsContent value="ledger" className="mt-4 min-h-[34rem]">
          <CustomerLedgerTab customerId={customerId} enabled={activeTab === "ledger"} />
        </TabsContent>

        <TabsContent value="sales-orders" className="mt-4 min-h-[34rem]">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">{tOrders("title")}</CardTitle>
                <CardDescription>Sales orders created for this customer.</CardDescription>
              </div>
              <CreateGuard resource={RESOURCES.SALES_ORDERS}>
                <Button type="button" onClick={handleCreateSalesOrder}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {tOrders("createOrder")}
                </Button>
              </CreateGuard>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={tOrders("searchPlaceholder")}
                    value={salesOrderSearch}
                    onChange={(event) => {
                      setSalesOrderSearch(event.target.value);
                      setSalesOrderPage(1);
                    }}
                    className="pl-8"
                  />
                </div>
                <Select
                  value={salesOrderStatusFilter}
                  onValueChange={handleSalesOrderStatusFilterChange}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder={tCommon("status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tCommon("allStatuses")}</SelectItem>
                    <SelectItem value="draft">{tOrders("draft")}</SelectItem>
                    <SelectItem value="confirmed">{tOrders("confirmed")}</SelectItem>
                    <SelectItem value="in_progress">{tOrders("inProgress")}</SelectItem>
                    <SelectItem value="shipped">{tOrders("shipped")}</SelectItem>
                    <SelectItem value="delivered">{tOrders("delivered")}</SelectItem>
                    <SelectItem value="invoiced">{tOrders("invoiced")}</SelectItem>
                    <SelectItem value="cancelled">{tOrders("cancelled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isSalesOrdersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((row) => (
                    <Skeleton key={row} className="h-12 w-full" />
                  ))}
                </div>
              ) : salesOrdersError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {tOrders("loadError")}
                </div>
              ) : customerSalesOrders.length === 0 ? (
                <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {tOrders("empty")}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tOrders("orderNumber")}</TableHead>
                          <TableHead>{tOrders("orderDate")}</TableHead>
                          <TableHead>{tOrders("expectedDelivery")}</TableHead>
                          <TableHead className="text-right">{tOrders("amount")}</TableHead>
                          <TableHead>{tCommon("status")}</TableHead>
                          <TableHead className="text-right">{tCommon("actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerSalesOrders.map((order) => (
                          <TableRow
                            key={order.id}
                            role="button"
                            tabIndex={0}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleViewSalesOrder(order)}
                            onKeyDown={(event) => {
                              if (event.currentTarget !== event.target) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleViewSalesOrder(order);
                              }
                            }}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {getSalesOrderStatusIcon(order.status)}
                                {order.orderNumber}
                              </div>
                            </TableCell>
                            <TableCell>{formatQuotationDate(order.orderDate)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {formatQuotationDate(order.expectedDeliveryDate)}
                                {isSalesOrderOverdue(order.expectedDeliveryDate, order.status) ? (
                                  <Badge
                                    variant="secondary"
                                    className="bg-red-100 text-xs text-red-800"
                                  >
                                    {tOrders("overdue")}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="font-medium">{formatCurrency(order.totalAmount)}</div>
                              <div className="text-xs text-muted-foreground">
                                {tOrders("itemsCount", {
                                  count: String(order.lineItems.length),
                                })}
                              </div>
                            </TableCell>
                            <TableCell>{getSalesOrderStatus(order.status)}</TableCell>
                            <TableCell
                              className="text-right"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="flex justify-end gap-2">
                                {(order.status === "draft" || order.status === "confirmed") ? (
                                  <EditGuard resource={RESOURCES.SALES_ORDERS}>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => handleEditSalesOrder(order)}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      {tCommon("edit")}
                                    </Button>
                                  </EditGuard>
                                ) : null}
                                {order.status === "draft" ? (
                                  <EditGuard resource={RESOURCES.SALES_ORDERS}>
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      className="h-8 bg-green-600 px-2 hover:bg-green-700"
                                      onClick={() => handleConfirmSalesOrder(order)}
                                      disabled={confirmOrder.isPending}
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      {tOrders("confirm")}
                                    </Button>
                                  </EditGuard>
                                ) : null}
                                {(order.status === "confirmed" ||
                                  order.status === "in_progress") ? (
                                  <CreateGuard resource={RESOURCES.SALES_INVOICES}>
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => handleConvertSalesOrderToInvoice(order)}
                                      disabled={convertToInvoice.isPending}
                                    >
                                      <Receipt className="mr-2 h-4 w-4" />
                                      {tOrders("invoice")}
                                    </Button>
                                  </CreateGuard>
                                ) : null}
                                {canCreateFrameJobOrder(order) ? (
                                  <CreateGuard resource={RESOURCES.MANUFACTURING}>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => handleCreateSalesOrderJobOrder(order)}
                                      disabled={createFrameJobOrder.isPending}
                                    >
                                      <ClipboardList className="mr-2 h-4 w-4" />
                                      {tOrders("createJobOrder")}
                                    </Button>
                                  </CreateGuard>
                                ) : null}
                                {order.frameJobOrder ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2"
                                    asChild
                                  >
                                    <Link href={`/sales/frame-job-orders/${order.frameJobOrder.id}`}>
                                      <ClipboardList className="mr-2 h-4 w-4" />
                                      {tOrders("viewJobOrder")}
                                    </Link>
                                  </Button>
                                ) : null}
                                {canCancelSalesOrder(order) ? (
                                  <EditGuard resource={RESOURCES.SALES_ORDERS}>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 w-8 p-0"
                                          aria-label={tOrders("moreActions")}
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={() => setOrderToCancel(order)}
                                        >
                                          <XCircle className="mr-2 h-4 w-4" />
                                          {tOrders("cancelOrder")}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </EditGuard>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {salesOrderPagination && salesOrderPagination.total > 0 ? (
                    <DataTablePagination
                      currentPage={salesOrderPage}
                      totalPages={salesOrderPagination.totalPages}
                      pageSize={salesOrderPageSize}
                      totalItems={salesOrderPagination.total}
                      onPageChange={setSalesOrderPage}
                      onPageSizeChange={setSalesOrderPageSize}
                    />
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotations" className="mt-4 min-h-[34rem]">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">{tQuotations("title")}</CardTitle>
                <CardDescription>Quotations created for this customer.</CardDescription>
              </div>
              <CreateGuard resource={RESOURCES.SALES_ORDERS}>
                <Button type="button" onClick={handleCreateSalesOrder}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {tQuotations("createSalesOrder")}
                </Button>
              </CreateGuard>
            </CardHeader>
            <CardContent className="space-y-4">
              {isQuotationsLoading && customerQuotations.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((row) => (
                    <Skeleton key={row} className="h-12 w-full" />
                  ))}
                </div>
              ) : quotationsError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {tQuotations("loadError")}
                </div>
              ) : customerQuotations.length === 0 ? (
                <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {tQuotations("empty")}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tQuotations("quotationNumber")}</TableHead>
                          <TableHead>{tQuotations("date")}</TableHead>
                          <TableHead>{tQuotations("validUntil")}</TableHead>
                          <TableHead className="text-right">{tQuotations("amount")}</TableHead>
                          <TableHead>{tCommon("status")}</TableHead>
                          <TableHead className="text-right">{tCommon("actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerQuotations.map((quotation) => (
                          <TableRow
                            key={quotation.id}
                            role="button"
                            tabIndex={0}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => openQuotation(quotation)}
                            onKeyDown={(event) => {
                              if (event.currentTarget !== event.target) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openQuotation(quotation);
                              }
                            }}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {getQuotationIcon(quotation.status)}
                                {quotation.quotationNumber}
                              </div>
                            </TableCell>
                            <TableCell>{formatQuotationDate(quotation.quotationDate)}</TableCell>
                            <TableCell>{formatQuotationDate(quotation.validUntil)}</TableCell>
                            <TableCell className="text-right">
                              <div className="font-medium">
                                {formatCurrency(quotation.totalAmount)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {tQuotations("itemsCount", {
                                  count: String(quotation.lineItems.length),
                                })}
                              </div>
                            </TableCell>
                            <TableCell>{getQuotationStatus(quotation.status)}</TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(event) => event.stopPropagation()}
                          >
                              <div className="flex justify-end gap-2">
                                {(quotation.status === "draft" || quotation.status === "sent") && (
                                  <EditGuard resource={RESOURCES.SALES_QUOTATIONS}>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => handleEditQuotation(quotation)}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      {tCommon("edit")}
                                    </Button>
                                  </EditGuard>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => openQuotation(quotation)}
                                >
                                  {tCommon("view")}
                                </Button>
                                {canChangeQuotationStatus(quotation.status) ? (
                                  <EditGuard resource={RESOURCES.SALES_QUOTATIONS}>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 w-8 p-0"
                                          disabled={changeStatus.isPending}
                                          aria-label={tQuotations("changeStatus")}
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {getAvailableQuotationStatuses(quotation.status).map(
                                          (status) => {
                                            const Icon = status.icon;
                                            return (
                                              <DropdownMenuItem
                                                key={status.value}
                                                onClick={() =>
                                                  handleChangeQuotationStatus(
                                                    quotation,
                                                    status.value
                                                  )
                                                }
                                              >
                                                <Icon className="mr-2 h-4 w-4" />
                                                <span>{status.label}</span>
                                              </DropdownMenuItem>
                                            );
                                          }
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </EditGuard>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {quotationsData?.pagination.hasMore && (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isQuotationsFetching || !quotationsData.pagination.nextCursor}
                        onClick={() => setQuotationCursor(quotationsData.pagination.nextCursor)}
                      >
                        {isQuotationsFetching ? tCommon("loading") : tCommon("loadMore")}
                      </Button>
                    </div>
                  )}
                </>
              )}
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
                <DetailItem
                  icon={FileText}
                  label="Created"
                  value={formatDate(customer.createdAt)}
                />
                <DetailItem
                  icon={FileText}
                  label="Updated"
                  value={formatDate(customer.updatedAt)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editOpen ? (
        <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      ) : null}
      {quotationViewOpen ? (
        <QuotationViewDialog
          open={quotationViewOpen}
          onOpenChange={setQuotationViewOpen}
          quotation={selectedQuotation}
        />
      ) : null}
      {salesOrderDialogOpen && (selectedSalesOrder || salesOrderInitialValues) ? (
        <SalesOrderFormDialog
          open={salesOrderDialogOpen}
          onOpenChange={(open) => {
            setSalesOrderDialogOpen(open);
            if (!open) {
              setSelectedSalesOrder(null);
              setSalesOrderInitialValues(null);
            }
          }}
          salesOrder={selectedSalesOrder}
          initialMode={selectedSalesOrder ? salesOrderDialogMode : "edit"}
          initialValues={salesOrderInitialValues ?? undefined}
        />
      ) : null}
      <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tOrders("selectWarehouseTitle")}</DialogTitle>
            <DialogDescription>
              {orderToCreateJobOrder
                ? tOrders("selectJobOrderWarehouseDescription")
                : tOrders("selectWarehouseDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedWarehouse}
              onValueChange={(value) => {
                setSelectedWarehouse(value);
                setSelectedLocation("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={tOrders("selectWarehouse")} />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pb-2">
            <Select
              value={selectedLocation}
              onValueChange={setSelectedLocation}
              disabled={!selectedWarehouse}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    selectedWarehouse
                      ? tOrders("selectLocationOptional")
                      : tOrders("selectWarehouseFirst")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.code} {location.name ? `- ${location.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={
                orderToCreateJobOrder
                  ? handleConfirmJobOrderCreation
                  : handleConfirmInvoiceConversion
              }
              disabled={
                !selectedWarehouse || convertToInvoice.isPending || createFrameJobOrder.isPending
              }
            >
              {orderToCreateJobOrder
                ? createFrameJobOrder.isPending
                  ? tOrders("creatingJobOrder")
                  : tOrders("createJobOrder")
                : convertToInvoice.isPending
                  ? tOrders("converting")
                  : tOrders("createInvoice")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!orderToCancel}
        onOpenChange={(open) => {
          if (!open) setOrderToCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tOrders("cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tOrders("cancelDescription", {
                number: orderToCancel?.orderNumber ?? "this order",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancelSalesOrder}
              disabled={cancelOrder.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelOrder.isPending ? tOrders("cancelling") : tOrders("confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm quotation</AlertDialogTitle>
            <AlertDialogDescription>
              Confirming {quotationToConfirm?.quotationNumber ?? "this quotation"} will mark the
              quotation as accepted. Sales orders are created manually from the sales order module
              or this customer quotation tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmQuotation}
              disabled={confirmQuotation.isPending}
            >
              {confirmQuotation.isPending ? "Confirming..." : "Confirm quotation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
