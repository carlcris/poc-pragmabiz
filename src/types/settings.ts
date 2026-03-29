import { LucideIcon } from "lucide-react";

// ============================================================================
// BASE TYPES
// ============================================================================

export type SettingValue = string | number | boolean | object | null;

export interface Setting {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  group_key: string;
  setting_key: string;
  value: SettingValue;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface SettingsGroup {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  permission: string;
}

// ============================================================================
// COMPANY SETTINGS
// ============================================================================

export interface CompanySettings {
  code: string;
  name: string;
  legal_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  currency_code?: string;
  is_active: boolean;
}

export const COMPANY_SETTING_KEYS = {
  CODE: "code",
  NAME: "name",
  LEGAL_NAME: "legal_name",
  TAX_ID: "tax_id",
  EMAIL: "email",
  PHONE: "phone",
  ADDRESS_LINE1: "address_line1",
  ADDRESS_LINE2: "address_line2",
  CITY: "city",
  STATE: "state",
  POSTAL_CODE: "postal_code",
  COUNTRY: "country",
  CURRENCY_CODE: "currency_code",
  IS_ACTIVE: "is_active",
} as const;

// ============================================================================
// FINANCIAL SETTINGS
// ============================================================================

export interface FinancialSettings {
  default_tax_rate: number;
  default_payment_terms: number; // days
  fiscal_year_start: string; // MM-DD format
  invoice_prefix: string;
  invoice_start_number: number;
  quote_prefix: string;
  quote_start_number: number;
  credit_note_prefix: string;
  auto_calculate_tax: boolean;
}

export const FINANCIAL_SETTING_KEYS = {
  DEFAULT_TAX_RATE: "default_tax_rate",
  DEFAULT_PAYMENT_TERMS: "default_payment_terms",
  FISCAL_YEAR_START: "fiscal_year_start",
  INVOICE_PREFIX: "invoice_prefix",
  INVOICE_START_NUMBER: "invoice_start_number",
  QUOTE_PREFIX: "quote_prefix",
  QUOTE_START_NUMBER: "quote_start_number",
  CREDIT_NOTE_PREFIX: "credit_note_prefix",
  AUTO_CALCULATE_TAX: "auto_calculate_tax",
} as const;

// ============================================================================
// INVENTORY SETTINGS
// ============================================================================

export interface InventorySettings {
  default_uom: string;
  low_stock_threshold: number;
  critical_stock_threshold: number;
  valuation_method: "FIFO" | "LIFO" | "AVERAGE" | "STANDARD";
  auto_allocation_enabled: boolean;
  negative_stock_allowed: boolean;
  track_lot_numbers: boolean;
  track_serial_numbers: boolean;
  barcode_format: string;
}

export const INVENTORY_SETTING_KEYS = {
  DEFAULT_UOM: "default_uom",
  LOW_STOCK_THRESHOLD: "low_stock_threshold",
  CRITICAL_STOCK_THRESHOLD: "critical_stock_threshold",
  VALUATION_METHOD: "valuation_method",
  AUTO_ALLOCATION_ENABLED: "auto_allocation_enabled",
  NEGATIVE_STOCK_ALLOWED: "negative_stock_allowed",
  TRACK_LOT_NUMBERS: "track_lot_numbers",
  TRACK_SERIAL_NUMBERS: "track_serial_numbers",
  BARCODE_FORMAT: "barcode_format",
} as const;

export const VALUATION_METHODS = [
  { value: "FIFO", label: "First In, First Out (FIFO)" },
  { value: "LIFO", label: "Last In, First Out (LIFO)" },
  { value: "AVERAGE", label: "Weighted Average" },
  { value: "STANDARD", label: "Standard Cost" },
] as const;

// ============================================================================
// POS SETTINGS
// ============================================================================

export interface POSSettings {
  receipt_header: string;
  receipt_footer: string;
  show_logo_on_receipt: boolean;
  allow_discounts: boolean;
  max_discount_percent: number;
  require_manager_approval_threshold: number;
  cash_drawer_enabled: boolean;
  print_receipt_auto: boolean;
  default_payment_method: string;
}

export const POS_SETTING_KEYS = {
  RECEIPT_HEADER: "receipt_header",
  RECEIPT_FOOTER: "receipt_footer",
  SHOW_LOGO_ON_RECEIPT: "show_logo_on_receipt",
  ALLOW_DISCOUNTS: "allow_discounts",
  MAX_DISCOUNT_PERCENT: "max_discount_percent",
  REQUIRE_MANAGER_APPROVAL_THRESHOLD: "require_manager_approval_threshold",
  CASH_DRAWER_ENABLED: "cash_drawer_enabled",
  PRINT_RECEIPT_AUTO: "print_receipt_auto",
  DEFAULT_PAYMENT_METHOD: "default_payment_method",
} as const;

// ============================================================================
// WORKFLOW SETTINGS
// ============================================================================

export interface WorkflowSettings {
  purchase_order_approval_required: boolean;
  po_approval_threshold: number;
  po_auto_approve_below: number;
  stock_request_approval_required: boolean;
  sr_approval_threshold: number;
  delivery_note_approval_required: boolean;
  send_email_notifications: boolean;
  notification_email: string;
}

export const WORKFLOW_SETTING_KEYS = {
  PURCHASE_ORDER_APPROVAL_REQUIRED: "purchase_order_approval_required",
  PO_APPROVAL_THRESHOLD: "po_approval_threshold",
  PO_AUTO_APPROVE_BELOW: "po_auto_approve_below",
  STOCK_REQUEST_APPROVAL_REQUIRED: "stock_request_approval_required",
  SR_APPROVAL_THRESHOLD: "sr_approval_threshold",
  DELIVERY_NOTE_APPROVAL_REQUIRED: "delivery_note_approval_required",
  SEND_EMAIL_NOTIFICATIONS: "send_email_notifications",
  NOTIFICATION_EMAIL: "notification_email",
} as const;

// ============================================================================
// INTEGRATION SETTINGS
// ============================================================================

export interface IntegrationSettings {
  api_enabled: boolean;
  webhook_url?: string;
  webhook_secret?: string;
  accounting_integration: "none" | "quickbooks" | "xero" | "sage";
  accounting_sync_enabled: boolean;
  ecommerce_integration?: string;
}

export const INTEGRATION_SETTING_KEYS = {
  API_ENABLED: "api_enabled",
  WEBHOOK_URL: "webhook_url",
  WEBHOOK_SECRET: "webhook_secret",
  ACCOUNTING_INTEGRATION: "accounting_integration",
  ACCOUNTING_SYNC_ENABLED: "accounting_sync_enabled",
  ECOMMERCE_INTEGRATION: "ecommerce_integration",
} as const;

export const ACCOUNTING_INTEGRATIONS = [
  { value: "none", label: "None" },
  { value: "quickbooks", label: "QuickBooks" },
  { value: "xero", label: "Xero" },
  { value: "sage", label: "Sage" },
] as const;

// ============================================================================
// BUSINESS UNIT SETTINGS
// ============================================================================

export interface BusinessUnitSettings {
  display_name?: string;
  short_code?: string;
  local_email?: string;
  local_phone?: string;
  manager_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
  operating_hours_start?: string;
  operating_hours_end?: string;
  days_open?: string[]; // ['mon', 'tue', 'wed', ...]
  receipt_header?: string;
  receipt_footer?: string;
}

export const BUSINESS_UNIT_SETTING_KEYS = {
  DISPLAY_NAME: "display_name",
  SHORT_CODE: "short_code",
  LOCAL_EMAIL: "local_email",
  LOCAL_PHONE: "local_phone",
  MANAGER_NAME: "manager_name",
  ADDRESS_LINE1: "address_line1",
  ADDRESS_LINE2: "address_line2",
  CITY: "city",
  STATE: "state",
  POSTAL_CODE: "postal_code",
  COUNTRY: "country",
  TIMEZONE: "timezone",
  OPERATING_HOURS_START: "operating_hours_start",
  OPERATING_HOURS_END: "operating_hours_end",
  DAYS_OPEN: "days_open",
  RECEIPT_HEADER: "receipt_header",
  RECEIPT_FOOTER: "receipt_footer",
} as const;

// ============================================================================
// SECURITY SETTINGS
// ============================================================================

export interface SecuritySettings {
  session_timeout_minutes: number;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
  require_mfa: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  password_expiry_days: number;
}

export const SECURITY_SETTING_KEYS = {
  SESSION_TIMEOUT_MINUTES: "session_timeout_minutes",
  PASSWORD_MIN_LENGTH: "password_min_length",
  PASSWORD_REQUIRE_UPPERCASE: "password_require_uppercase",
  PASSWORD_REQUIRE_LOWERCASE: "password_require_lowercase",
  PASSWORD_REQUIRE_NUMBERS: "password_require_numbers",
  PASSWORD_REQUIRE_SPECIAL: "password_require_special",
  REQUIRE_MFA: "require_mfa",
  MAX_LOGIN_ATTEMPTS: "max_login_attempts",
  LOCKOUT_DURATION_MINUTES: "lockout_duration_minutes",
  PASSWORD_EXPIRY_DAYS: "password_expiry_days",
} as const;

// ============================================================================
// HELPER TYPES
// ============================================================================

export type SettingsGroupKey =
  | "company"
  | "financial"
  | "inventory"
  | "pos"
  | "workflow"
  | "integration"
  | "business_unit"
  | "security";

export type SettingsByGroup = {
  company: CompanySettings;
  financial: FinancialSettings;
  inventory: InventorySettings;
  pos: POSSettings;
  workflow: WorkflowSettings;
  integration: IntegrationSettings;
  business_unit: BusinessUnitSettings;
  security: SecuritySettings;
};

// Utility type to get settings type by group key
export type SettingsForGroup<T extends SettingsGroupKey> = SettingsByGroup[T];
