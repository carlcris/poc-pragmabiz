export type BusinessUnit = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
  access?: {
    role: string;
    is_default: boolean;
  };
};

export type BusinessUnitsResponse = {
  data: BusinessUnit[];
};

export type SetBusinessUnitResponse = {
  success: boolean;
  message?: string;
  business_unit_id: string;
  business_unit: BusinessUnit;
  token: string;
  refreshToken: string;
  cookieHeader: string;
};
