export type DashboardPickList = {
  id: string;
  code: string;
  status: "pending" | "in_progress" | "paused";
  deliveryNoteCode: string | null;
  warehouseName: string | null;
  lineCount: number;
  pickedLineCount: number;
};

export type DashboardData = {
  receiving: {
    ready: number;
    inProgress: number;
  };
  picking: {
    pending: number;
    inProgress: number;
    assignedPickList: DashboardPickList | null;
  };
  urgentStockRequests: number;
};
