export type MobileUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  username: string;
  firstName: string;
  lastName: string;
};

export type PermissionAction = "view" | "create" | "edit" | "delete";

export type ResourcePermission = {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type MobilePermissionMap = Record<string, ResourcePermission>;

export type MobileCapabilityMap = Record<string, ResourcePermission>;

export type AuthSession = {
  user: MobileUser;
  token: string;
  refreshToken: string;
  cookieHeader: string;
  permissions: MobilePermissionMap;
  capabilities: MobileCapabilityMap;
  currentBusinessUnit?: {
    id: string;
    code: string;
    name: string;
  } | null;
};

export type LoginResponse = {
  user: MobileUser;
  token: string;
  refreshToken: string;
  cookieHeader: string;
  permissions: MobilePermissionMap;
  capabilities: MobileCapabilityMap;
  currentBusinessUnit?: {
    id: string;
    code: string;
    name: string;
  } | null;
};
