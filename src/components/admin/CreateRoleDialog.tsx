"use client";

import { useState, useEffect } from "react";
import { Shield, Copy } from "lucide-react";
import { useRoles, useRole, useCreateRole, useAssignPermissions } from "@/hooks/useRoles";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CreateRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type RolePermission = {
  permission_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export function CreateRoleDialog({ open, onOpenChange }: CreateRoleDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [copyFromRoleId, setCopyFromRoleId] = useState<string>("");

  const { data: rolesData } = useRoles();
  const { data: copyFromRoleData } = useRole(copyFromRoleId || undefined);
  const createRole = useCreateRole();
  const assignPermissions = useAssignPermissions();

  const roles = rolesData?.data || [];

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setCopyFromRoleId("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }

    try {
      // Create the role
      const newRole = (await createRole.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      })) as { data: { id: string } };

      // If copying from an existing role and it has permissions, assign them
      if (
        copyFromRoleId &&
        copyFromRoleData?.permissions &&
        copyFromRoleData.permissions.length > 0
      ) {
        const permissionsToAssign: RolePermission[] = (
          copyFromRoleData.permissions as RolePermission[]
        ).map((perm) => ({
          permission_id: perm.permission_id,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
        }));

        await assignPermissions.mutateAsync({
          roleId: newRole.data.id,
          permissions: permissionsToAssign,
        });

        toast.success(
          `Role "${name}" created with permissions copied from "${copyFromRoleData.name}"`
        );
      } else {
        toast.success(`Role "${name}" created successfully`);
      }

      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create role";
      toast.error(errorMessage);
    }
  };

  const isLoading = createRole.isPending || assignPermissions.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Create New Role
          </DialogTitle>
          <DialogDescription>
            Create a new role with optional permissions copied from an existing role
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Role Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Warehouse Manager"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the role's purpose and responsibilities"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="copyFrom" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Copy Permissions From (Optional)
            </Label>
            <Select value={copyFromRoleId} onValueChange={setCopyFromRoleId} disabled={isLoading}>
              <SelectTrigger id="copyFrom">
                <SelectValue placeholder="Select a role to copy permissions from" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3" />
                      <span>{role.name}</span>
                      {role.is_system_role && (
                        <span className="text-xs text-muted-foreground">(System)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {copyFromRoleId && copyFromRoleData && (
              <p className="text-xs text-muted-foreground">
                Will copy {copyFromRoleData.permissions?.length || 0} permission(s) from &quot;
                {copyFromRoleData.name}&quot;
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
