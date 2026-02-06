export type NotificationType =
  | "load_list_status"
  | "customer_registration_submitted"
  | "customer_registration_approved"
  | "customer_registration_rejected"
  | "system";

export type Notification = {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  metadata?: Record<string, unknown> | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
};
