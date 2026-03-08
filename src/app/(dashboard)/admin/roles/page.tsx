"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, Shield, Plus, Pencil, Trash2, Key } from "lucide-react";
import { useRoles, useDeleteRole } from "@/hooks/useRoles";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RolePermissionsDialog } from "@/components/admin/RolePermissionsDialog";
import { CreateRoleDialog } from "@/components/admin/CreateRoleDialog";
import { EditRoleDialog } from "@/components/admin/EditRoleDialog";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { CreateGuard, EditGuard, DeleteGuard } from "@/components/permissions/PermissionGuard";
import { RESOURCES } from "@/constants/resources";

type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
};

function RoleManagementContent() {
  const t = useTranslations("adminRolesPage");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);

  const { data: rolesData, isLoading, error } = useRoles({
    search,
    page: 1,
    limit: 50,
  });
  const deleteRole = useDeleteRole();

  const roles = rolesData?.data || [];

  const handleDeleteClick = (role: Role) => {
    if (role.is_system_role) {
      toast.error(t("cannotDeleteSystemRoles"));
      return;
    }
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;

    try {
      await deleteRole.mutateAsync(roleToDelete.id);
      toast.success(t("roleDeletedSuccess", { name: roleToDelete.name }));
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    } catch {
      toast.error(t("roleDeletedError"));
    }
  };

  const handleManagePermissions = (role: Role) => {
    setSelectedRole(role);
    setPermissionsDialogOpen(true);
  };

  const handleEditClick = (role: Role) => {
    setRoleToEdit(role);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">{t("title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{t("subtitle")}</p>
        </div>
        <CreateGuard resource={RESOURCES.ROLES}>
          <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto flex-shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            {t("createRole")}
          </Button>
        </CreateGuard>
      </div>

      <div className="space-y-4">
        <div className="relative w-full">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {isLoading ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{tCommon("description")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("created")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-64" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-8 w-32" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            {t("loadError")}
          </div>
        ) : roles.length === 0 ? (
          <EmptyStatePanel
            icon={Shield}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{tCommon("description")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("created")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {role.description || t("noDescription")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {role.is_system_role ? (
                        <Badge variant="secondary">{t("system")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("custom")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(role.created_at).toLocaleDateString(locale)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <EditGuard resource={RESOURCES.ROLES}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManagePermissions(role)}
                          >
                            <Key className="mr-2 h-4 w-4" />
                            {t("permissions")}
                          </Button>
                        </EditGuard>
                        <EditGuard resource={RESOURCES.ROLES}>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={role.is_system_role}
                            onClick={() => handleEditClick(role)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </EditGuard>
                        <DeleteGuard resource={RESOURCES.ROLES}>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={role.is_system_role}
                            onClick={() => handleDeleteClick(role)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </DeleteGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { name: roleToDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRole.isPending ? t("deleting") : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Role Dialog */}
      <CreateRoleDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {/* Edit Role Dialog */}
      {roleToEdit && (
        <EditRoleDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} role={roleToEdit} />
      )}

      {/* Permissions Management Dialog */}
      {selectedRole && (
        <RolePermissionsDialog
          open={permissionsDialogOpen}
          onOpenChange={setPermissionsDialogOpen}
          role={selectedRole}
        />
      )}
    </div>
  );
}

export default function RoleManagementPage() {
  return (
    <ProtectedRoute resource={RESOURCES.ROLES}>
      <RoleManagementContent />
    </ProtectedRoute>
  );
}
