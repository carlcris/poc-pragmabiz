"use client";

import { useState } from "react";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  const { data: usersData, isLoading, error } = useUsers();
  const toggleStatus = useToggleUserStatus();

  const users = usersData?.data || [];

  // Filter users by search and status
  const filteredUsers = users.filter((user) => {
    // Search filter
    const matchesSearch = search
      ? user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(search.toLowerCase())
      : true;

    // Status filter
    const matchesStatus =
      statusFilter === "all" ? true :
      statusFilter === "active" ? user.is_active :
      !user.is_active;

    return matchesSearch && matchesStatus;
  });

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
          ? `User ${user.email} deactivated`
          : `User ${user.email} activated`
      );
    } catch (error) {
      toast.error("Failed to update user status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage users and assign roles
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email, username, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All ({users.length})
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
            >
              Active ({users.filter(u => u.is_active).length})
            </Button>
            <Button
              variant={statusFilter === "inactive" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("inactive")}
            >
              Inactive ({users.filter(u => !u.is_active).length})
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            Error loading users. Please try again.
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No users found.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
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
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageRoles(user)}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Manage Roles
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPermissions(user)}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          View Permissions
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
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              Activate
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
