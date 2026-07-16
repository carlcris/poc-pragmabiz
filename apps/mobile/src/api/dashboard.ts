import { apiRequest } from "@/api/client";
import type { DashboardData } from "@/contracts/dashboard";

export const getDashboard = () => apiRequest<DashboardData>("/api/mobile/warehouse-dashboard");
