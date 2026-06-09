export type MobileUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  username: string;
  firstName: string;
  lastName: string;
};

export type AuthSession = {
  user: MobileUser;
  token: string;
  refreshToken: string;
  cookieHeader: string;
  currentBusinessUnit?: {
    id: string;
    code: string;
    name: string;
  } | null;
};

export type LoginResponse = {
  user: MobileUser;
  token: string;
  refreshToken: string;
};
