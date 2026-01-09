export type UnitOfMeasure = {
  id: string;
  code: string;
  name: string;
  symbol?: string | null;
  isBaseUnit?: boolean;
  isActive?: boolean;
};

export type UnitsOfMeasureResponse = {
  data: UnitOfMeasure[];
};
