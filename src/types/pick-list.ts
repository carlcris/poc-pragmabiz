export type PickListStatus = "pending" | "in_progress" | "paused" | "cancelled" | "done";

export type PickListItem = {
  id: string;
  company_id: string;
  pick_list_id: string;
  dn_item_id: string;
  sr_id: string;
  sr_item_id: string;
  item_id: string;
  uom_id: string;
  allocated_qty: number;
  picked_qty: number;
  short_qty: number;
  created_at: string;
  updated_at: string;
  items?: {
    item_name: string | null;
    item_code: string | null;
    sku: string | null;
  } | null;
  units_of_measure?: {
    symbol: string | null;
    name: string | null;
  } | null;
};

export type PickListAssignee = {
  company_id: string;
  pick_list_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string | null;
  users?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export type PickList = {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  dn_id: string;
  pick_list_no: string;
  status: PickListStatus;
  notes: string | null;
  cancel_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  delivery_notes?: {
    id: string;
    dn_no: string;
    status: string;
    requesting_warehouse_id: string;
    fulfilling_warehouse_id: string;
  } | null;
  pick_list_items?: PickListItem[];
  pick_list_assignees?: PickListAssignee[];
};

export type PickListListResponse = {
  data: PickList[];
};

export type CreatePickListPayload = {
  dnId: string;
  pickerUserIds: string[];
  notes?: string;
};

export type UpdatePickListStatusPayload = {
  status: PickListStatus;
  reason?: string;
};

export type UpdatePickListItemsPayload = {
  items: Array<{
    pickListItemId: string;
    pickedQty: number;
  }>;
};
