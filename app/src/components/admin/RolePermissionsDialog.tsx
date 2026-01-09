"use client";

import { useState, useEffect, useMemo } from "react";
import { Key, Loader2, Search } from "lucide-react";
import { useRole } from "@/hooks/useRoles";
import { usePermissionsList } from "@/hooks/usePermissionsManagement";
import { useAssignPermissions } from "@/hooks/useRoles";
import { toast } from "sonner";
import { toProperCase } from "@/lib/string";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
};

type Permission = {
  id: string;
  resource: string;
  description: string | null;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type RolePermission = {
  permission_id: string;
  resource: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type PermissionSettings = {
  permission_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type RolePermissionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
};

export function RolePermissionsDialog({
  open,
  onOpenChange,
  role,
}: RolePermissionsDialogProps) {
  const { data: roleData, isLoading: loadingRole } = useRole(role.id);
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissionsList();
  const assignPermissions = useAssignPermissions();

  // Track permission settings { permission_id: { can_view, can_create, can_edit, can_delete } }
  const [permissionSettings, setPermissionSettings] = useState<Map<string, PermissionSettings>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const allPermissions = useMemo(
    () => permissionsData?.data || [],
    [permissionsData?.data]
  );
  const rolePermissions: RolePermission[] = roleData?.permissions || [];

  // Filter permissions based on search query
  const filteredPermissions = allPermissions.filter((permission: Permission) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      permission.resource.toLowerCase().includes(query) ||
      permission.description?.toLowerCase().includes(query)
    );
  });

  // Initialize permission settings when role data loads
  useEffect(() => {
    if (!roleData?.permissions || allPermissions.length === 0) {
      return;
    }

    if (roleData?.permissions) {
      const settings = new Map<string, PermissionSettings>();

      roleData.permissions.forEach((rp: RolePermission) => {
        const perm = allPermissions.find((p: Permission) => p.resource === rp.resource);
        if (perm) {
          settings.set(perm.id, {
            permission_id: perm.id,
            can_view: rp.can_view,
            can_create: rp.can_create,
            can_edit: rp.can_edit,
            can_delete: rp.can_delete,
          });
        }
      });

      setPermissionSettings(settings);
      setHasChanges(false);
    }
  }, [roleData, allPermissions]);

  const isPermissionAssigned = (permissionId: string) => {
    return permissionSettings.has(permissionId);
  };

  const togglePermission = (permissionId: string, permission: Permission) => {
    setPermissionSettings((prev) => {
      const newSettings = new Map(prev);

      if (newSettings.has(permissionId)) {
        // Remove permission
        newSettings.delete(permissionId);
      } else {
        // Add permission with default CRUD flags from the permission definition
        newSettings.set(permissionId, {
          permission_id: permissionId,
          can_view: permission.can_view,
          can_create: permission.can_create,
          can_edit: permission.can_edit,
          can_delete: permission.can_delete,
        });
      }

      setHasChanges(true);
      return newSettings;
    });
  };

  const toggleCrudFlag = (
    permissionId: string,
    flag: 'can_view' | 'can_create' | 'can_edit' | 'can_delete'
  ) => {
    setPermissionSettings((prev) => {
      const newSettings = new Map(prev);
      const current = newSettings.get(permissionId);

      if (current) {
        newSettings.set(permissionId, {
          ...current,
          [flag]: !current[flag],
        });
        setHasChanges(true);
      }

      return newSettings;
    });
  };

  const handleSave = async () => {
    try {
      // Convert Map to array of permission settings
      const permissionsToAssign = Array.from(permissionSettings.values());

      await assignPermissions.mutateAsync({
        roleId: role.id,
        permissions: permissionsToAssign,
      });
      toast.success("Permissions updated successfully");
      setHasChanges(false);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update permissions");
    }
  };

  const handleCancel = () => {
    // Reset to original permissions
    if (roleData?.permissions) {
      const settings = new Map<string, PermissionSettings>();

      roleData.permissions.forEach((rp: RolePermission) => {
        const perm = allPermissions.find((p: Permission) => p.resource === rp.resource);
        if (perm) {
          settings.set(perm.id, {
            permission_id: perm.id,
            can_view: rp.can_view,
            can_create: rp.can_create,
            can_edit: rp.can_edit,
            can_delete: rp.can_delete,
          });
        }
      });

      setPermissionSettings(settings);
      setHasChanges(false);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Manage Permissions - {role.name}
          </DialogTitle>
          <DialogDescription>
            Select permissions and customize which actions this role can perform for each resource.
          </DialogDescription>
          {role.is_system_role && (
            <Badge variant="secondary" className="w-fit">
              System Role - Read Only
            </Badge>
          )}
        </DialogHeader>

        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search permissions by resource or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-auto">
          {loadingRole || loadingPermissions ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPermissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? (
                <>No permissions match your search &quot;{searchQuery}&quot;</>
              ) : (
                <>No permissions found in the system.</>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPermissions.map((permission: Permission) => {
                const isAssigned = isPermissionAssigned(permission.id);
                const settings = permissionSettings.get(permission.id);

                return (
                  <div
                    key={permission.id}
                    className={cn(
                      "border rounded-lg p-4 transition-colors",
                      isAssigned ? "bg-accent/30" : "hover:bg-accent/10"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isAssigned}
                        onCheckedChange={() => togglePermission(permission.id, permission)}
                        disabled={role.is_system_role}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {toProperCase(permission.resource)}
                          </span>
                        </div>
                        {permission.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {permission.description}
                          </p>
                        )}

                        {/* CRUD Checkboxes - Only show if permission is assigned */}
                        {isAssigned && settings && (
                          <div className="flex items-center gap-6 mt-3 pl-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={settings.can_view}
                                onCheckedChange={() => toggleCrudFlag(permission.id, 'can_view')}
                                disabled={role.is_system_role || !permission.can_view}
                              />
                              <span className="text-sm">View</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={settings.can_create}
                                onCheckedChange={() => toggleCrudFlag(permission.id, 'can_create')}
                                disabled={role.is_system_role || !permission.can_create}
                              />
                              <span className="text-sm">Create</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={settings.can_edit}
                                onCheckedChange={() => toggleCrudFlag(permission.id, 'can_edit')}
                                disabled={role.is_system_role || !permission.can_edit}
                              />
                              <span className="text-sm">Edit</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={settings.can_delete}
                                onCheckedChange={() => toggleCrudFlag(permission.id, 'can_delete')}
                                disabled={role.is_system_role || !permission.can_delete}
                              />
                              <span className="text-sm">Delete</span>
                            </label>
                          </div>
                        )}

                        {/* Show available CRUD operations for reference */}
                        {!isAssigned && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>Available:</span>
                            {permission.can_view && <span className="text-green-600">View</span>}
                            {permission.can_create && <span className="text-green-600">Create</span>}
                            {permission.can_edit && <span className="text-green-600">Edit</span>}
                            {permission.can_delete && <span className="text-green-600">Delete</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {permissionSettings.size} of {allPermissions.length} permissions assigned
            {searchQuery && (
              <span className="ml-2">
                ({filteredPermissions.length} shown)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || assignPermissions.isPending || role.is_system_role}
            >
              {assignPermissions.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper function for className merging
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
