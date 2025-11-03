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

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) =>
      invoicesApi.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create invoice");
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceRequest }) =>
      invoicesApi.updateInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update invoice");
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicesApi.deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete invoice");
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicesApi.sendInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice sent successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invoice");
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecordPaymentRequest) => invoicesApi.recordPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Payment recorded successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to record payment");
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicesApi.cancelInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice cancelled");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel invoice");
    },
  });
}
