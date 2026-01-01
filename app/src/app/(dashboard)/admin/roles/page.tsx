"use client";

import { useState } from "react";
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
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);

  const { data: rolesData, isLoading, error } = useRoles();
  const deleteRole = useDeleteRole();

  const roles = rolesData?.data || [];

  // Filter roles by search
  const filteredRoles = roles.filter((role) =>
    search
      ? role.name.toLowerCase().includes(search.toLowerCase()) ||
        (role.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
      : true
  );

  const handleDeleteClick = (role: Role) => {
    if (role.is_system_role) {
      toast.error("Cannot delete system roles");
      return;
    }
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;

    try {
      await deleteRole.mutateAsync(roleToDelete.id);
      toast.success(`Role "${roleToDelete.name}" deleted successfully`);
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    } catch (error) {
      toast.error("Failed to delete role");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground">
            Manage roles and their permissions
          </p>
        </div>
        <CreateGuard resource={RESOURCES.ROLES}>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        </CreateGuard>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search roles by name or description..."
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
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            Error loading roles. Please try again.
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No roles found.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {role.description || "No description"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {role.is_system_role ? (
                        <Badge variant="secondary">System</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(role.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManagePermissions(role)}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Permissions
                        </Button>
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the role &quot;{roleToDelete?.name}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRole.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Role Dialog */}
      <CreateRoleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Edit Role Dialog */}
      {roleToEdit && (
        <EditRoleDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          role={roleToEdit}
        />
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
