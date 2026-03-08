"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, Shield, UserCheck, UserX, Key } from "lucide-react";
import { useUsers, useToggleUserStatus } from "@/hooks/useUsers";
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
import { UserRolesDialog } from "@/components/admin/UserRolesDialog";
import { UserPermissionsDialog } from "@/components/admin/UserPermissionsDialog";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { RESOURCES } from "@/constants/resources";

type User = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
};

function UserManagementContent() {
  const t = useTranslations("adminUsersPage");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  const { data: usersData, isLoading, error } = useUsers({
    search,
    page: 1,
    limit: 50,
    isActive: statusFilter === "all" ? undefined : statusFilter === "active",
  });
  const toggleStatus = useToggleUserStatus();

  const users = usersData?.data || [];

  const handleManageRoles = (user: User) => {
    setSelectedUser(user);
    setRolesDialogOpen(true);
  };

  const handleViewPermissions = (user: User) => {
    setSelectedUser(user);
    setPermissionsDialogOpen(true);
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await toggleStatus.mutateAsync({
        userId: user.id,
        isActive: !user.is_active,
      });
      toast.success(
        user.is_active
          ? t("statusUpdatedInactive", { email: user.email })
          : t("statusUpdatedActive", { email: user.email })
      );
    } catch {
      toast.error(t("statusUpdateError"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">{t("title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{t("subtitle")}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="w-full sm:w-auto"
            >
              {t("all")}
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
              className="w-full sm:w-auto"
            >
              {t("active")}
            </Button>
            <Button
              variant={statusFilter === "inactive" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("inactive")}
              className="w-full sm:w-auto"
            >
              {t("inactive")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("user")}</TableHead>
                  <TableHead>{t("username")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
                  <TableHead>{t("created")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
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
        ) : users.length === 0 ? (
          <EmptyStatePanel
            icon={UserCheck}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("user")}</TableHead>
                  <TableHead>{t("username")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
                  <TableHead>{t("created")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.is_active ? "outline" : "secondary"}
                        className={
                          user.is_active
                            ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
                            : ""
                        }
                      >
                        {user.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString(locale)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleManageRoles(user)}>
                          <Shield className="mr-2 h-4 w-4" />
                          {t("manageRoles")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPermissions(user)}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          {t("viewPermissions")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(user)}
                          disabled={toggleStatus.isPending}
                        >
                          {user.is_active ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" />
                              {t("deactivate")}
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              {t("activate")}
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedUser && (
        <>
          <UserRolesDialog
            open={rolesDialogOpen}
            onOpenChange={setRolesDialogOpen}
            user={selectedUser}
          />
          <UserPermissionsDialog
            open={permissionsDialogOpen}
            onOpenChange={setPermissionsDialogOpen}
            user={selectedUser}
          />
        </>
      )}
    </div>
  );
}

export default function UserManagementPage() {
  return (
    <ProtectedRoute resource={RESOURCES.USERS}>
      <UserManagementContent />
    </ProtectedRoute>
  );
}
