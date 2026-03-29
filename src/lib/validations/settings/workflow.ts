import { z } from "zod";

export const createWorkflowSettingsSchema = () =>
  z.object({
    purchase_order_approval_required: z.boolean().default(false),
    po_approval_threshold: z
      .number()
      .min(0, "Threshold must be 0 or greater"),
    po_auto_approve_below: z
      .number()
      .min(0, "Auto-approve threshold must be 0 or greater"),
    stock_request_approval_required: z.boolean().default(false),
    sr_approval_threshold: z
      .number()
      .min(0, "Threshold must be 0 or greater"),
    delivery_note_approval_required: z.boolean().default(false),
    send_email_notifications: z.boolean().default(true),
    notification_email: z
      .string()
      .email("Invalid email address")
      .max(100)
      .optional()
      .or(z.literal("")),
  });

type WorkflowSettingsSchema = ReturnType<typeof createWorkflowSettingsSchema>;

export type WorkflowSettingsFormInput = z.input<WorkflowSettingsSchema>;
export type WorkflowSettingsFormData = z.output<WorkflowSettingsSchema>;
