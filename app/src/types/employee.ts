// Employee roles
export type EmployeeRole = "admin" | "manager" | "sales_agent" | "warehouse_staff" | "accountant";

// Employment status
export type EmploymentStatus = "active" | "inactive" | "terminated" | "on_leave";

// Employee entity
export interface Employee {
  id: string;
  companyId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;

  // Employment details
  role: EmployeeRole;
  department?: string;
  hireDate: string;
  terminationDate?: string;
  employmentStatus: EmploymentStatus;

  // Sales commission
  commissionRate: number; // Percentage (e.g., 5.00 = 5%)

  // Territories (optional, loaded from API)
  territories?: string[];

  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  regionState?: string;
  country: string;
  postalCode?: string;

  // Emergency contact
  emergencyContactName?: string;
  emergencyContactPhone?: string;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Employee distribution location (territory)
export interface EmployeeDistributionLocation {
  id: string;
  companyId: string;
  employeeId: string;
  city: string;
  regionState: string;
  isPrimary: boolean;
  assignedDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Invoice employee association (for commission split)
export interface InvoiceEmployee {
  id: string;
  companyId: string;
  invoiceId: string;
  employeeId: string;
  commissionSplitPercentage: number; // e.g., 50.00 = 50%
  commissionAmount: number;
  createdAt: string;
}

// Sales distribution aggregated data
export interface SalesDistribution {
  id: string;
  companyId: string;
  date: string;
  employeeId: string;
  city: string;
  regionState: string;
  totalSales: number;
  totalCommission: number;
  transactionCount: number;
  averageOrderValue: number;
  createdAt: string;
  updatedAt: string;
}

// Request/Response types
export interface CreateEmployeeRequest {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: EmployeeRole;
  department?: string;
  hireDate: string;
  commissionRate?: number;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  regionState?: string;
  country?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  employmentStatus?: EmploymentStatus;
  terminationDate?: string;
  isActive?: boolean;
}

export interface EmployeeFilters {
  search?: string;
  role?: EmployeeRole;
  employmentStatus?: EmploymentStatus;
  city?: string;
  regionState?: string;
  page?: number;
  limit?: number;
}

// Territory assignment
export interface CreateTerritoryRequest {
  city: string;
  regionState: string;
  isPrimary?: boolean;
  notes?: string;
}

export type UpdateTerritoryRequest = Partial<CreateTerritoryRequest>;

// Helper types
export interface EmployeeWithTerritories extends Employee {
  territories: EmployeeDistributionLocation[];
}

export interface EmployeePerformance {
  employee: Employee;
  totalSales: number;
  totalCommission: number;
  transactionCount: number;
  averageOrderValue: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

// Philippines location references
export const MINDANAO_CITIES = [
  "Davao City",
  "Cagayan de Oro City",
  "General Santos City",
  "Zamboanga City",
  "Butuan City",
  "Iligan City",
  "Cotabato City",
  "Koronadal City",
  "Pagadian City",
  "Digos City",
] as const;

export const MINDANAO_REGIONS = [
  "Davao Region",
  "Northern Mindanao",
  "Zamboanga Peninsula",
  "SOCCSKSARGEN",
  "Caraga",
  "BARMM",
] as const;

export type MindanaoCity = typeof MINDANAO_CITIES[number];
export type MindanaoRegion = typeof MINDANAO_REGIONS[number];

// City to Region mapping
export const CITY_TO_REGION: Record<MindanaoCity, MindanaoRegion> = {
  "Davao City": "Davao Region",
  "Cagayan de Oro City": "Northern Mindanao",
  "General Santos City": "SOCCSKSARGEN",
  "Zamboanga City": "Zamboanga Peninsula",
  "Butuan City": "Caraga",
  "Iligan City": "Northern Mindanao",
  "Cotabato City": "BARMM",
  "Koronadal City": "SOCCSKSARGEN",
  "Pagadian City": "Zamboanga Peninsula",
  "Digos City": "Davao Region",
};
