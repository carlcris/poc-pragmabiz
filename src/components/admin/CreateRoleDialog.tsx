"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("adminCreateRoleDialog");
  const tCommon = useTranslations("common");
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
      toast.error(t("roleNameRequired"));
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

        toast.success(t("roleCreatedWithCopySuccess", { name, source: copyFromRoleData.name }));
      } else {
        toast.success(t("roleCreatedSuccess", { name }));
      }

      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("roleCreateError");
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
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {t("roleName")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder={t("roleNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("descriptionLabel")}</Label>
            <Textarea
              id="description"
              placeholder={t("descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="copyFrom" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              {t("copyPermissionsFrom")}
            </Label>
            <Select value={copyFromRoleId} onValueChange={setCopyFromRoleId} disabled={isLoading}>
              <SelectTrigger id="copyFrom">
                <SelectValue placeholder={t("selectRolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3" />
                      <span>{role.name}</span>
                      {role.is_system_role && (
                        <span className="text-xs text-muted-foreground">{t("system")}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {copyFromRoleId && copyFromRoleData && (
              <p className="text-xs text-muted-foreground">
                {t("copySummary", {
                  count: String(copyFromRoleData.permissions?.length || 0),
                  name: copyFromRoleData.name,
                })}
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
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t("creating") : t("createRole")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
