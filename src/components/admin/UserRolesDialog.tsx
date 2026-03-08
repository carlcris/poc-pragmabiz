"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Shield, Plus, X, Loader2 } from "lucide-react";
import { useUserRoles, useAssignRole, useRemoveRole } from "@/hooks/useUsers";
import { useRoles } from "@/hooks/useRoles";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type User = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
};

type UserRolesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
};

export function UserRolesDialog({ open, onOpenChange, user }: UserRolesDialogProps) {
  const t = useTranslations("adminUserRolesDialog");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string>("");

  const { data: userRolesData, isLoading: loadingUserRoles } = useUserRoles(user.id);
  const { data: rolesData, isLoading: loadingRoles } = useRoles();
  const { data: businessUnitsData, isLoading: loadingBusinessUnits } = useBusinessUnits();

  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();

  const userRoles = userRolesData?.data || [];
  const allRoles = rolesData?.data || [];
  const businessUnits = businessUnitsData || [];

  const handleAssignRole = async () => {
    if (!selectedRoleId || !selectedBusinessUnitId) {
      toast.error(t("selectRoleAndBusinessUnit"));
      return;
    }

    try {
      await assignRole.mutateAsync({
        userId: user.id,
        roleId: selectedRoleId,
        businessUnitId: selectedBusinessUnitId,
      });

      toast.success(t("roleAssignedSuccess"));
      setSelectedRoleId("");
      setSelectedBusinessUnitId("");
    } catch {
      toast.error(t("roleAssignedError"));
    }
  };

  const handleRemoveRole = async (roleId: string, businessUnitId: string) => {
    try {
      await removeRole.mutateAsync({
        userId: user.id,
        roleId,
        businessUnitId,
      });

      toast.success(t("roleRemovedSuccess"));
    } catch {
      toast.error(t("roleRemovedError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("title", { name: `${user.first_name} ${user.last_name}` })}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Roles */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t("currentRoles")}</h3>
            {loadingUserRoles ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : userRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRoles")}</p>
            ) : (
              <div className="space-y-2">
                {userRoles.map((userRole) => (
                  <div
                    key={`${userRole.id}-${userRole.business_unit_id}`}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{userRole.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {userRole.business_unit_name || t("unknownBusinessUnit")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRole(userRole.id, userRole.business_unit_id)}
                      disabled={removeRole.isPending}
                    >
                      {removeRole.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign New Role */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium">{t("assignNewRole")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("role")}</label>
                {loadingRoles ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      {allRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            {role.name}
                            {role.is_system_role && (
                              <Badge variant="secondary" className="text-xs">
                                {t("system")}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("businessUnit")}</label>
                {loadingBusinessUnits ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedBusinessUnitId} onValueChange={setSelectedBusinessUnitId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectBusinessUnit")} />
                    </SelectTrigger>
                    <SelectContent>
                      {businessUnits.map((bu) => (
                        <SelectItem key={bu.id} value={bu.id}>
                          {bu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <Button
              onClick={handleAssignRole}
              disabled={!selectedRoleId || !selectedBusinessUnitId || assignRole.isPending}
              className="w-full"
            >
              {assignRole.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("assigning")}
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("assignRole")}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
