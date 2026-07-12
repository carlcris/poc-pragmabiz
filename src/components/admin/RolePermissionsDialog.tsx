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
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";

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
  parent_resource?: string | null;
  surface?: string | null;
  capability_key?: string | null;
  capability_action?: string | null;
  label?: string | null;
  permission_group?: string | null;
  is_granular?: boolean | null;
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

type PermissionSection = {
  key: string;
  title: string;
  modulePermission?: Permission;
  childGroups: Array<{
    title: string;
    permissions: Permission[];
  }>;
};

type PermissionSectionDraft = Omit<PermissionSection, "childGroups"> & {
  childGroups: Map<string, Permission[]>;
};

const ACTION_FLAGS = ["can_view", "can_create", "can_edit", "can_delete"] as const;
type PermissionActionFlag = (typeof ACTION_FLAGS)[number];
type PermissionCopy = {
  title: string;
  description: string;
};
type PermissionCopyByResource = Record<string, PermissionCopy | undefined>;

const getModuleTitle = (resource: string) => toProperCase(resource.replace(/[_-]+/g, " "));

const getPermissionTitle = (
  permission: Permission,
  permissionCopyByResource: PermissionCopyByResource
) =>
  permissionCopyByResource[permission.resource]?.title ||
  permission.label?.trim() ||
  getModuleTitle(permission.resource);

const getPermissionDescription = (
  permission: Permission,
  permissionCopyByResource: PermissionCopyByResource
) => permissionCopyByResource[permission.resource]?.description || permission.description;

const getGranularActionFlag = (permission: Permission): PermissionActionFlag | null => {
  const actionFlag = `can_${permission.capability_action || ""}`;
  return ACTION_FLAGS.includes(actionFlag as PermissionActionFlag)
    ? (actionFlag as PermissionActionFlag)
    : null;
};

const permissionMatchesSearch = (
  permission: Permission,
  query: string,
  permissionCopyByResource: PermissionCopyByResource
) => {
  if (!query) return true;

  const haystack = [
    permission.resource,
    permission.description,
    permission.label,
    permission.permission_group,
    permission.parent_resource,
    permission.surface,
    permission.capability_key,
    getPermissionTitle(permission, permissionCopyByResource),
    getPermissionDescription(permission, permissionCopyByResource),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
};

const groupPermissions = (
  permissions: Permission[],
  searchQuery: string,
  permissionCopyByResource: PermissionCopyByResource
): PermissionSection[] => {
  const sections = new Map<string, PermissionSectionDraft>();

  const ensureSection = (key: string) => {
    const normalizedKey = key || "additional";
    const existing = sections.get(normalizedKey);
    if (existing) return existing;

    const section: PermissionSectionDraft = {
      key: normalizedKey,
      title:
        normalizedKey === "additional" ? "Additional Capabilities" : getModuleTitle(normalizedKey),
      childGroups: new Map<string, Permission[]>(),
    };
    sections.set(normalizedKey, section);
    return section;
  };

  permissions.forEach((permission) => {
    if (permission.is_granular) {
      const parentResource = permission.parent_resource || permission.resource.split(".")[0];
      const section = ensureSection(parentResource);
      const groupTitle =
        permission.permission_group || getModuleTitle(permission.surface || "Capabilities");
      const groupPermissions = section.childGroups.get(groupTitle) || [];
      groupPermissions.push(permission);
      section.childGroups.set(groupTitle, groupPermissions);
      return;
    }

    const section = ensureSection(permission.resource);
    section.modulePermission = permission;
  });

  return Array.from(sections.values())
    .map((section) => {
      const moduleMatches = section.modulePermission
        ? permissionMatchesSearch(section.modulePermission, searchQuery, permissionCopyByResource)
        : false;
      const childGroups = Array.from(section.childGroups.entries())
        .map(([title, permissions]) => ({
          title,
          permissions: permissions
            .filter(
              (permission) =>
                !searchQuery ||
                moduleMatches ||
                permissionMatchesSearch(permission, searchQuery, permissionCopyByResource)
            )
            .sort((a, b) =>
              getPermissionTitle(a, permissionCopyByResource).localeCompare(
                getPermissionTitle(b, permissionCopyByResource)
              )
            ),
        }))
        .filter((group) => group.permissions.length > 0);

      return {
        key: section.key,
        title: section.title,
        modulePermission: !searchQuery || moduleMatches ? section.modulePermission : undefined,
        childGroups,
      };
    })
    .filter((section) => section.modulePermission || section.childGroups.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
};

export function RolePermissionsDialog({ open, onOpenChange, role }: RolePermissionsDialogProps) {
  const t = useTranslations("adminRolePermissionsDialog");
  const tCommon = useTranslations("common");
  const { data: roleData, isLoading: loadingRole } = useRole(role.id);
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissionsList();
  const assignPermissions = useAssignPermissions();
  const permissionCopyByResource = useMemo<PermissionCopyByResource>(
    () => ({
      [GRANULAR_CAPABILITIES.GRN_RECEIVING_START]: {
        title: t("capabilities.startGrnReceiving"),
        description: t("capabilities.startGrnReceivingDescription"),
      },
      [GRANULAR_CAPABILITIES.PICK_LIST_VIEW_ONLY_ASSIGNED]: {
        title: t("capabilities.viewAssignedPickLists"),
        description: t("capabilities.viewAssignedPickListsDescription"),
      },
      [GRANULAR_CAPABILITIES.ITEM_BATCH_QR_PRINT]: {
        title: t("capabilities.printBatchQr"),
        description: t("capabilities.printBatchQrDescription"),
      },
    }),
    [t]
  );

  // Track permission settings { permission_id: { can_view, can_create, can_edit, can_delete } }
  const [permissionSettings, setPermissionSettings] = useState<Map<string, PermissionSettings>>(
    new Map()
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const allPermissions = useMemo(() => permissionsData?.data || [], [permissionsData?.data]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const permissionSections = useMemo(
    () => groupPermissions(allPermissions, normalizedSearchQuery, permissionCopyByResource),
    [allPermissions, normalizedSearchQuery, permissionCopyByResource]
  );
  const shownPermissionCount = permissionSections.reduce((count, section) => {
    const moduleCount = section.modulePermission ? 1 : 0;
    const childCount = section.childGroups.reduce(
      (total, group) => total + group.permissions.length,
      0
    );
    return count + moduleCount + childCount;
  }, 0);

  // Initialize permission settings when role data loads
  useEffect(() => {
    if (!roleData?.permissions) {
      return;
    }

    if (roleData?.permissions) {
      const settings = new Map<string, PermissionSettings>();

      roleData.permissions.forEach((rp: RolePermission) => {
        settings.set(rp.permission_id, {
          permission_id: rp.permission_id,
          can_view: rp.can_view,
          can_create: rp.can_create,
          can_edit: rp.can_edit,
          can_delete: rp.can_delete,
        });
      });

      setPermissionSettings(settings);
      setHasChanges(false);
    }
  }, [roleData]);

  const isPermissionActionEnabled = (permissionId: string, flag: (typeof ACTION_FLAGS)[number]) => {
    return permissionSettings.get(permissionId)?.[flag] ?? false;
  };

  const setModuleAction = (
    section: PermissionSection,
    flag: (typeof ACTION_FLAGS)[number],
    checked: boolean
  ) => {
    if (!section.modulePermission) return;

    setPermissionSettings((prev) => {
      const newSettings = new Map(prev);
      const current = newSettings.get(section.modulePermission!.id) ?? {
        permission_id: section.modulePermission!.id,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };

      const updated = {
        ...current,
        [flag]: checked,
      };

      if (updated.can_view || updated.can_create || updated.can_edit || updated.can_delete) {
        newSettings.set(section.modulePermission!.id, updated);
      } else {
        newSettings.delete(section.modulePermission!.id);
      }

      if (flag === "can_view" && !checked) {
        section.childGroups.forEach((group) => {
          group.permissions.forEach((permission) => {
            newSettings.delete(permission.id);
          });
        });
      }

      setHasChanges(true);
      return newSettings;
    });
  };

  const toggleGranularPermission = (section: PermissionSection, permission: Permission) => {
    const actionFlag = getGranularActionFlag(permission);
    if (!actionFlag || !permission[actionFlag]) return;

    setPermissionSettings((prev) => {
      const newSettings = new Map(prev);

      if (newSettings.has(permission.id)) {
        newSettings.delete(permission.id);
      } else {
        newSettings.set(permission.id, {
          permission_id: permission.id,
          can_view: permission.can_view,
          can_create: permission.can_create,
          can_edit: permission.can_edit,
          can_delete: permission.can_delete,
        });

        if (section.modulePermission?.can_view) {
          const parentSettings = newSettings.get(section.modulePermission.id) ?? {
            permission_id: section.modulePermission.id,
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
          };

          newSettings.set(section.modulePermission.id, {
            ...parentSettings,
            can_view: true,
          });
        }
      }

      setHasChanges(true);
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
        settings.set(rp.permission_id, {
          permission_id: rp.permission_id,
          can_view: rp.can_view,
          can_create: rp.can_create,
          can_edit: rp.can_edit,
          can_delete: rp.can_delete,
        });
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
          ) : permissionSections.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery ? (
                <>{t("noSearchResults", { query: searchQuery })}</>
              ) : (
                <>{t("noPermissionsInSystem")}</>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {permissionSections.map((section) => (
                <section key={section.key} className="rounded-lg border bg-background">
                  <div className="border-b px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold">{section.title}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Module access and related granular controls
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="shrink-0">
                          {section.childGroups.reduce(
                            (total, group) => total + group.permissions.length,
                            section.modulePermission ? 1 : 0
                          )}{" "}
                          permissions
                        </Badge>

                        {section.modulePermission && (
                          <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                            {ACTION_FLAGS.map((flag) => {
                              const settings = permissionSettings.get(section.modulePermission!.id);
                              const supported = section.modulePermission?.[flag] ?? false;
                              const label =
                                flag === "can_view"
                                  ? tCommon("view")
                                  : flag === "can_create"
                                    ? tCommon("create")
                                    : flag === "can_edit"
                                      ? tCommon("edit")
                                      : tCommon("delete");

                              return (
                                <label
                                  key={flag}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-1.5 text-sm",
                                    !supported && "cursor-not-allowed opacity-40"
                                  )}
                                  title={!supported ? `${label} not available` : undefined}
                                >
                                  <Checkbox
                                    checked={settings?.[flag] ?? false}
                                    onCheckedChange={(checked) =>
                                      setModuleAction(section, flag, checked === true)
                                    }
                                    disabled={!supported}
                                  />
                                  <span>{label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {section.childGroups.length > 0 && (
                    <div className="space-y-4 px-4 py-4">
                      {section.childGroups.map((group) => (
                        <div key={group.title} className="space-y-2">
                          <div className="grid gap-2 md:grid-cols-2">
                            {group.permissions.map((permission) => (
                              <label
                                key={permission.id}
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 transition-colors",
                                  getGranularActionFlag(permission) &&
                                    isPermissionActionEnabled(
                                      permission.id,
                                      getGranularActionFlag(permission)!
                                    )
                                    ? "border-primary/30 bg-primary/5"
                                    : "hover:bg-muted/40"
                                )}
                              >
                                <Checkbox
                                  checked={Boolean(
                                    getGranularActionFlag(permission) &&
                                    isPermissionActionEnabled(
                                      permission.id,
                                      getGranularActionFlag(permission)!
                                    )
                                  )}
                                  onCheckedChange={() =>
                                    toggleGranularPermission(section, permission)
                                  }
                                  disabled={
                                    !getGranularActionFlag(permission) ||
                                    !permission[getGranularActionFlag(permission)!]
                                  }
                                  className="mt-0.5"
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium">
                                    {getPermissionTitle(permission, permissionCopyByResource)}
                                  </span>
                                  {getPermissionDescription(
                                    permission,
                                    permissionCopyByResource
                                  ) && (
                                    <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                                      {getPermissionDescription(
                                        permission,
                                        permissionCopyByResource
                                      )}
                                    </span>
                                  )}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
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
              <span className="ml-2">
                {t("shownSummary", { count: String(shownPermissionCount) })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || assignPermissions.isPending}>
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
