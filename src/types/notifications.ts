export type NotificationType =
  | "load_list_status"
  | "stock_request_workflow"
  | "pick_list_workflow"
  | "delivery_note_workflow"
  | "customer_registration_submitted"
  | "customer_registration_approved"
  | "customer_registration_rejected"
  | "system";

export type Notification = {
  id: string;
  company_id: string;
  business_unit_id?: string | null;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  metadata?: Record<string, unknown> | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
};
