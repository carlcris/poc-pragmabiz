/**
 * Business Unit Types
 *
 * Type definitions for multi-business unit support
 * Reference: docs/plans/multi-business-unit-prd.md
 */

export type BusinessUnitType = "primary" | "branch" | "outlet" | "warehouse" | "shop" | "office";

export type BusinessUnit = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  type: BusinessUnitType;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type UserBusinessUnitAccess = {
  user_id: string;
  business_unit_id: string;
  role: "admin" | "manager" | "staff";
  is_default: boolean;
  granted_at: string;
  granted_by: string | null;
};

export type BusinessUnitWithAccess = BusinessUnit & {
  access: {
    role: UserBusinessUnitAccess["role"];
    is_default: boolean;
  };
};

export type BusinessUnitContextValue = {
  current_business_unit_id: string | null;
};

export type SetBusinessUnitContextParams = {
  business_unit_id: string;
};
