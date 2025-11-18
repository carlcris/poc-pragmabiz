import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { employeesApi } from "@/lib/api/employees";
import type {
  EmployeeFilters,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  CreateTerritoryRequest,
  UpdateTerritoryRequest,
} from "@/types/employee";

const EMPLOYEES_QUERY_KEY = "employees";
const TERRITORIES_QUERY_KEY = "territories";
const PERFORMANCE_QUERY_KEY = "employee-performance";

// Employee CRUD hooks
export function useEmployees(filters?: EmployeeFilters) {
  return useQuery({
    queryKey: [EMPLOYEES_QUERY_KEY, filters],
    queryFn: () => employeesApi.getEmployees(filters),
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: [EMPLOYEES_QUERY_KEY, id],
    queryFn: () => employeesApi.getEmployee(id),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEmployeeRequest) => employeesApi.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeRequest }) =>
      employeesApi.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => employeesApi.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] });
    },
  });
}

// Territory management hooks
export function useTerritories(employeeId: string) {
  return useQuery({
    queryKey: [TERRITORIES_QUERY_KEY, employeeId],
    queryFn: () => employeesApi.getTerritories(employeeId),
    enabled: !!employeeId,
  });
}

export function useCreateTerritory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ employeeId, data }: { employeeId: string; data: CreateTerritoryRequest }) =>
      employeesApi.createTerritory(employeeId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [TERRITORIES_QUERY_KEY, variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] });
    },
  });
}

export function useUpdateTerritory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      territoryId,
      data,
    }: {
      employeeId: string;
      territoryId: string;
      data: UpdateTerritoryRequest;
    }) => employeesApi.updateTerritory(employeeId, territoryId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [TERRITORIES_QUERY_KEY, variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] });
    },
  });
}

export function useDeleteTerritory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ employeeId, territoryId }: { employeeId: string; territoryId: string }) =>
      employeesApi.deleteTerritory(employeeId, territoryId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [TERRITORIES_QUERY_KEY, variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] });
    },
  });
}

// Performance hooks
export function useEmployeePerformance(
  employeeId: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: [PERFORMANCE_QUERY_KEY, employeeId, startDate, endDate],
    queryFn: () => employeesApi.getEmployeePerformance(employeeId, startDate, endDate),
    enabled: !!employeeId,
  });
}
