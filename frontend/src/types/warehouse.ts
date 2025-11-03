export interface Warehouse {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  managerId?: string;
  managerName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseRequest {
  companyId: string;
  code: string;
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  managerId?: string;
  isActive: boolean;
}

export interface UpdateWarehouseRequest {
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  managerId?: string;
  isActive: boolean;
}

export interface WarehouseFilters {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface WarehouseListResponse {
  data: Warehouse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
