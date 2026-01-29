"use client";

import { useState } from "react";
import { Key, Search, Shield, Eye, Plus, Edit, Trash2 } from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { toProperCase } from "@/lib/string";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type User = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
};

type UserPermissionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  businessUnitId?: string;
};

export function UserPermissionsDialog({
  open,
  onOpenChange,
  user,
  businessUnitId,
}: UserPermissionsDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: permissionsData, isLoading } = useUserPermissions(user.id, businessUnitId);

  const permissions = permissionsData?.permissions || [];

  // Filter permissions based on search query
  const filteredPermissions = permissions.filter((permission) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return permission.resource.toLowerCase().includes(query);
  });

  // Count active permissions
  const activePermissions = permissions.filter(
    (p) => p.can_view || p.can_create || p.can_edit || p.can_delete
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Effective Permissions - {user.first_name} {user.last_name}
          </DialogTitle>
          <DialogDescription>
            Aggregated permissions from all roles assigned to this user
          </DialogDescription>
          <div className="flex items-center gap-2 pt-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {activePermissions.length} Active Permission
              {activePermissions.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="secondary">{user.email}</Badge>
          </div>
        </DialogHeader>

        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search permissions by resource..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPermissions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery ? (
                <>No permissions match your search &quot;{searchQuery}&quot;</>
              ) : (
                <>This user has no permissions assigned.</>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead className="w-24 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-24 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Plus className="h-3 w-3" />
                        <span>Create</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-24 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Edit className="h-3 w-3" />
                        <span>Edit</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-24 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPermissions.map((permission) => {
                    const hasAnyPermission =
                      permission.can_view ||
                      permission.can_create ||
                      permission.can_edit ||
                      permission.can_delete;

                    return (
                      <TableRow
                        key={permission.resource}
                        className={!hasAnyPermission ? "opacity-50" : ""}
                      >
                        <TableCell>
                          <span className="font-medium">{toProperCase(permission.resource)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {permission.can_view ? (
                            <Badge
                              variant="outline"
                              className="border-green-600 bg-green-50 text-green-700 dark:border-green-400 dark:bg-green-950 dark:text-green-400"
                            >
                              ✓
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {permission.can_create ? (
                            <Badge
                              variant="outline"
                              className="border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-400"
                            >
                              ✓
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {permission.can_edit ? (
                            <Badge
                              variant="outline"
                              className="border-yellow-600 bg-yellow-50 text-yellow-700 dark:border-yellow-400 dark:bg-yellow-950 dark:text-yellow-400"
                            >
                              ✓
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {permission.can_delete ? (
                            <Badge
                              variant="outline"
                              className="border-red-600 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950 dark:text-red-400"
                            >
                              ✓
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            Showing {filteredPermissions.length} of {permissions.length} permission
            {permissions.length !== 1 ? "s" : ""}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
