import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { invoicesApi } from "@/lib/api/invoices";
import type {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  InvoiceFilters,
  RecordPaymentRequest,
} from "@/types/invoice";
import { toast } from "sonner";

const INVOICES_KEY = "invoices";

type InvoiceMutationMessages = {
  success: string;
  error: string;
};

export function useInvoices(filters?: InvoiceFilters) {
  return useQuery({
    queryKey: [INVOICES_KEY, filters],
    queryFn: () => invoicesApi.getInvoices(filters),
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: [INVOICES_KEY, id],
    queryFn: () => invoicesApi.getInvoice(id),
    enabled: !!id,
  });
}

export function useCreateInvoice(messages?: InvoiceMutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) => invoicesApi.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success(messages?.success || "Invoice created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || messages?.error || "Failed to create invoice");
    },
  });
}

export function useUpdateInvoice(messages?: InvoiceMutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceRequest }) =>
      invoicesApi.updateInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success(messages?.success || "Invoice updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || messages?.error || "Failed to update invoice");
    },
  });
}

export function useDeleteInvoice(messages?: InvoiceMutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicesApi.deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success(messages?.success || "Invoice deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || messages?.error || "Failed to delete invoice");
    },
  });
}

export function useSendInvoice(messages?: InvoiceMutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicesApi.sendInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success(messages?.success || "Invoice sent successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || messages?.error || "Failed to send invoice");
    },
  });
}

export function useRecordPayment(messages?: InvoiceMutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecordPaymentRequest) => invoicesApi.recordPayment(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY, variables.invoiceId, "payments"] });
      toast.success(messages?.success || "Payment recorded successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || messages?.error || "Failed to record payment");
    },
  });
}

export function useCancelInvoice(messages?: InvoiceMutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicesApi.cancelInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success(messages?.success || "Invoice cancelled");
    },
    onError: (error: Error) => {
      toast.error(error.message || messages?.error || "Failed to cancel invoice");
    },
  });
}

export function useInvoicePayments(invoiceId: string) {
  return useQuery({
    queryKey: [INVOICES_KEY, invoiceId, "payments"],
    queryFn: () => invoicesApi.getPayments(invoiceId),
    enabled: !!invoiceId,
  });
}
