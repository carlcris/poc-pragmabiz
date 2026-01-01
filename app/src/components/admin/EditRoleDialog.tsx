"use client";

import { useState, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";
import { useUpdateRole } from "@/hooks/useRoles";
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

type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
};

type EditRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
};

export function EditRoleDialog({ open, onOpenChange, role }: EditRoleDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const updateRole = useUpdateRole();

  // Initialize form with role data
  useEffect(() => {
    if (open && role) {
      setName(role.name);
      setDescription(role.description || "");
    }
  }, [open, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }

    try {
      await updateRole.mutateAsync({
        roleId: role.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
        },
      });

      toast.success(`Role "${name}" updated successfully`);
      onOpenChange(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update role";
      toast.error(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Role
          </DialogTitle>
          <DialogDescription>
            Update the role name and description
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
              disabled={updateRole.isPending}
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
              disabled={updateRole.isPending}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateRole.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateRole.isPending}>
              {updateRole.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Role"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
