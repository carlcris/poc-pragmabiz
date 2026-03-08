"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
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

export function RolePermissionsDialog({ open, onOpenChange, role }: RolePermissionsDialogProps) {
  const t = useTranslations("adminRolePermissionsDialog");
  const tCommon = useTranslations("common");
  const { data: roleData, isLoading: loadingRole } = useRole(role.id);
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissionsList();
  const assignPermissions = useAssignPermissions();

  // Track permission settings { permission_id: { can_view, can_create, can_edit, can_delete } }
  const [permissionSettings, setPermissionSettings] = useState<Map<string, PermissionSettings>>(
    new Map()
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const allPermissions = useMemo(() => permissionsData?.data || [], [permissionsData?.data]);

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
    flag: "can_view" | "can_create" | "can_edit" | "can_delete"
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
      toast.success(t("permissionsUpdatedSuccess"));
      setHasChanges(false);
      onOpenChange(false);
    } catch {
      toast.error(t("permissionsUpdatedError"));
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
      <DialogContent className="flex h-[80vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t("title", { name: role.name })}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
          {role.is_system_role && (
            <Badge variant="secondary" className="w-fit">
              {t("systemRole")}
            </Badge>
          )}
        </DialogHeader>

        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
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
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery ? (
                <>{t("noSearchResults", { query: searchQuery })}</>
              ) : (
                <>{t("noPermissionsInSystem")}</>
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
                      "rounded-lg border p-4 transition-colors",
                      isAssigned ? "bg-accent/30" : "hover:bg-accent/10"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isAssigned}
                        onCheckedChange={() => togglePermission(permission.id, permission)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {toProperCase(permission.resource)}
                          </span>
                        </div>
                        {permission.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {permission.description}
                          </p>
                        )}

                        {/* CRUD Checkboxes - Only show if permission is assigned */}
                        {isAssigned && settings && (
                          <div className="mt-3 flex items-center gap-6 pl-1">
                            <label className="flex cursor-pointer items-center gap-2">
                              <Checkbox
                                checked={settings.can_view}
                                onCheckedChange={() => toggleCrudFlag(permission.id, "can_view")}
                                disabled={!permission.can_view}
                              />
                              <span className="text-sm">{tCommon("view")}</span>
                            </label>

                            <label className="flex cursor-pointer items-center gap-2">
                              <Checkbox
                                checked={settings.can_create}
                                onCheckedChange={() => toggleCrudFlag(permission.id, "can_create")}
                                disabled={!permission.can_create}
                              />
                              <span className="text-sm">{tCommon("create")}</span>
                            </label>

                            <label className="flex cursor-pointer items-center gap-2">
                              <Checkbox
                                checked={settings.can_edit}
                                onCheckedChange={() => toggleCrudFlag(permission.id, "can_edit")}
                                disabled={!permission.can_edit}
                              />
                              <span className="text-sm">{tCommon("edit")}</span>
                            </label>

                            <label className="flex cursor-pointer items-center gap-2">
                              <Checkbox
                                checked={settings.can_delete}
                                onCheckedChange={() => toggleCrudFlag(permission.id, "can_delete")}
                                disabled={!permission.can_delete}
                              />
                              <span className="text-sm">{tCommon("delete")}</span>
                            </label>
                          </div>
                        )}

                        {/* Show available CRUD operations for reference */}
                        {!isAssigned && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{t("available")}</span>
                            {permission.can_view && <span className="text-green-600">{tCommon("view")}</span>}
                            {permission.can_create && (
                              <span className="text-green-600">{tCommon("create")}</span>
                            )}
                            {permission.can_edit && <span className="text-green-600">{tCommon("edit")}</span>}
                            {permission.can_delete && (
                              <span className="text-green-600">{tCommon("delete")}</span>
                            )}
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
            {t("assignedSummary", {
              assigned: String(permissionSettings.size),
              total: String(allPermissions.length),
            })}
            {searchQuery && (
              <span className="ml-2">{t("shownSummary", { count: String(filteredPermissions.length) })}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || assignPermissions.isPending}
            >
              {assignPermissions.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("saveChanges")
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
  return classes.filter(Boolean).join(" ");
}
