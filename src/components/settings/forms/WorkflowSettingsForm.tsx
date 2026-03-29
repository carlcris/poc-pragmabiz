"use client";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createWorkflowSettingsSchema,
  type WorkflowSettingsFormInput,
  type WorkflowSettingsFormData,
} from "@/lib/validations/settings/workflow";
import { useUpdateSettings } from "@/hooks/settings/useSettings";
import { Loader2 } from "lucide-react";

interface WorkflowSettingsFormProps {
  initialData?: Partial<WorkflowSettingsFormData>;
}

export function WorkflowSettingsForm({ initialData }: WorkflowSettingsFormProps) {
  const t = useTranslations("adminSettings.workflowForm");
  const commonT = useTranslations("adminSettings.common");
  const updateSettings = useUpdateSettings("workflow");
  const schema = createWorkflowSettingsSchema();

  const form = useForm<WorkflowSettingsFormInput, unknown, WorkflowSettingsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      purchase_order_approval_required: initialData?.purchase_order_approval_required ?? false,
      po_approval_threshold: initialData?.po_approval_threshold || 10000,
      po_auto_approve_below: initialData?.po_auto_approve_below || 1000,
      stock_request_approval_required: initialData?.stock_request_approval_required ?? false,
      sr_approval_threshold: initialData?.sr_approval_threshold || 5000,
      delivery_note_approval_required: initialData?.delivery_note_approval_required ?? false,
      send_email_notifications: initialData?.send_email_notifications ?? true,
      notification_email: initialData?.notification_email || "",
    },
  });

  const onSubmit = async (data: WorkflowSettingsFormData) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success(t("saveSuccess"));
    } catch (error) {
      console.error("Error updating workflow settings:", error);
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const isLoading = updateSettings.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Purchase Order Approval */}
        <Card>
          <CardHeader>
            <CardTitle>{t("purchaseOrderApprovalTitle")}</CardTitle>
            <CardDescription>{t("purchaseOrderApprovalDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="purchase_order_approval_required"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("requireApproval")}</FormLabel>
                    <FormDescription>{t("purchaseOrderRequireApprovalDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="po_approval_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("approvalThreshold")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>{t("purchaseOrderApprovalThresholdDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="po_auto_approve_below"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("autoApproveBelow")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>{t("autoApproveBelowDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stock Request Approval */}
        <Card>
          <CardHeader>
            <CardTitle>{t("stockRequestApprovalTitle")}</CardTitle>
            <CardDescription>{t("stockRequestApprovalDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="stock_request_approval_required"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("requireApproval")}</FormLabel>
                    <FormDescription>{t("stockRequestRequireApprovalDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sr_approval_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("approvalThreshold")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="0"
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>{t("stockRequestApprovalThresholdDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Delivery Note Approval */}
        <Card>
          <CardHeader>
            <CardTitle>{t("deliveryNoteApprovalTitle")}</CardTitle>
            <CardDescription>{t("deliveryNoteApprovalDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="delivery_note_approval_required"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("requireApproval")}</FormLabel>
                    <FormDescription>{t("deliveryNoteRequireApprovalDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("notificationSettingsTitle")}</CardTitle>
            <CardDescription>{t("notificationSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="send_email_notifications"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("sendEmailNotifications")}</FormLabel>
                    <FormDescription>{t("sendEmailNotificationsDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notification_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notificationEmail")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder={t("notificationEmailPlaceholder")} />
                  </FormControl>
                  <FormDescription>{t("notificationEmailDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {commonT("saveChanges")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
