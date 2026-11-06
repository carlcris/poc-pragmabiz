export type UserProfileRole = {
  id: string;
  roleName: string;
  businessUnitName: string | null;
};

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: UserProfileRole[];
};

export type UserProfileUpdateInput = {
  firstName: string;
  lastName: string;
  phone: string;
};
