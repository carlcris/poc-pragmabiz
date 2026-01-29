export type ApiQueryParams = {
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  cashierId?: string;
  warehouseId?: string;
  itemId?: string;
  [key: string]: string | number | undefined;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ApiResponse<T> = {
  data: T;
  message?: string;
};

export type ApiError = {
  error: string;
  message?: string;
  details?: unknown;
};
