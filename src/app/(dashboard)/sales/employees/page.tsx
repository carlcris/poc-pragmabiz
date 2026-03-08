"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, MapPin, DollarSign, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployees } from "@/hooks/useEmployees";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { TerritoryManagementDialog } from "@/components/employees/territory-management-dialog";
import type { Employee } from "@/types/employee";

export default function EmployeesPage() {
  const t = useTranslations("employeesPage");
  const tCommon = useTranslations("common");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTerritoryDialogOpen, setIsTerritoryDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const limit = 5;
  const { data: employeesData, isLoading } = useEmployees({ page, limit, search: searchQuery });
  const employees = employeesData?.data || [];
  const pagination = employeesData?.pagination;

  // Reset to page 1 when search query changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsEditDialogOpen(true);
  };

  const handleManageTerritories = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsTerritoryDialogOpen(true);
  };

  const formatRole = (role: string) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "sales_agent":
        return t("salesAgent");
      case "sales_manager":
        return t("salesManager");
      case "territory_manager":
        return t("territoryManager");
      default:
        return formatRole(role);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addEmployee")}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalEmployees")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">
              {t("activeEmployees", { count: String(employees.filter((e) => e.isActive).length) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("avgCommissionRate")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employees.length > 0
                ? (
                    employees.reduce((sum, e) => sum + Number(e.commissionRate), 0) /
                    employees.length
                  ).toFixed(2)
                : "0.00"}
              %
            </div>
            <p className="text-xs text-muted-foreground">{t("avgCommissionRateDescription")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("territoriesCovered")}</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(employees.flatMap((e) => e.territories || [])).size}
            </div>
            <p className="text-xs text-muted-foreground">{t("territoriesCoveredDescription")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("employees")}</CardTitle>
          <CardDescription>{t("employeesDescription")}</CardDescription>
          <div className="flex items-center gap-2 pt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("firstName")}</TableHead>
                  <TableHead>{t("lastName")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("commissionRate")}</TableHead>
                  <TableHead>{t("territories")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {t("noEmployeesFound")}
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.firstName}</TableCell>
                      <TableCell>{employee.lastName}</TableCell>
                      <TableCell>{getRoleLabel(employee.role)}</TableCell>
                      <TableCell>{Number(employee.commissionRate).toFixed(2)}%</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {employee.territories && employee.territories.length > 0 ? (
                            employee.territories.slice(0, 2).map((territory, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {territory}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">{t("noTerritories")}</span>
                          )}
                          {employee.territories && employee.territories.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              {t("moreCount", { count: String(employee.territories.length - 2) })}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.isActive ? "default" : "secondary"}>
                          {employee.isActive ? tCommon("active") : tCommon("inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleManageTerritories(employee)}
                          >
                            <MapPin className="mr-1 h-4 w-4" />
                            {t("manageTerritories")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(employee)}>
                            {tCommon("edit")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {!isLoading && pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                {t("showingEmployees", {
                  from: String((pagination.page - 1) * pagination.limit + 1),
                  to: String(Math.min(pagination.page * pagination.limit, pagination.total)),
                  total: String(pagination.total),
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  {t("previous")}
                </Button>
                <div className="text-sm">
                  {t("pageOf", {
                    page: String(pagination.page),
                    totalPages: String(pagination.totalPages),
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EmployeeFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        mode="create"
      />

      {selectedEmployee && (
        <>
          <EmployeeFormDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            mode="edit"
            employee={selectedEmployee}
          />

          <TerritoryManagementDialog
            open={isTerritoryDialogOpen}
            onOpenChange={setIsTerritoryDialogOpen}
            employee={selectedEmployee}
          />
        </>
      )}
    </div>
  );
}
