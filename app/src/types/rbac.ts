import { Resource } from '@/constants/resources';

/**
 * Permission action types
 */
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

/**
 * Permission flags for a single resource
 */
export interface ResourcePermission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

/**
 * User's aggregated permissions across all resources
 * Key: resource name
 * Value: permission flags
 */
export type UserPermissions = Record<Resource, ResourcePermission>;

/**
 * Role entity from database
 */
export interface Role {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

/**
 * Permission entity from database
 */
export interface Permission {
  id: string;
  resource: Resource;
  description: string | null;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

/**
 * Role-Permission mapping
 */
export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
  created_by: string | null;
}

/**
 * User-Role assignment
 */
export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  business_unit_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

/**
 * Role with its permissions (for API responses)
 */
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

/**
 * User with their roles (for API responses)
 */
export interface UserWithRoles {
  id: string;
  email: string;
  name: string;
  roles: RoleWithPermissions[];
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  resource: Resource;
  action: PermissionAction;
  reason?: string;
}
