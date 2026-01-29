export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  employeeId?: string | null; // Link to employee record for commission tracking
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
