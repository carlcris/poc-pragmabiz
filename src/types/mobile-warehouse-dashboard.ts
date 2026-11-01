export type MobileWarehouseDashboardPickList = {
  id: string;
  code: string;
  status: "pending" | "in_progress" | "paused";
  deliveryNoteCode: string | null;
  warehouseName: string | null;
  lineCount: number;
  pickedLineCount: number;
};

export type MobileWarehouseDashboardData = {
  receiving: {
    ready: number;
    inProgress: number;
  };
  picking: {
    pending: number;
    inProgress: number;
    // The current user's assigned pick list: the oldest started one, else the oldest pending one.
    assignedPickList: MobileWarehouseDashboardPickList | null;
  };
  urgentStockRequests: number;
};
