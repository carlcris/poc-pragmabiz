import { RESOURCES } from "@/constants/resources";
import { requireAnyPermission } from "@/lib/auth";

export const requireLoadListReceivingView = () =>
  requireAnyPermission([
    [RESOURCES.LOAD_LISTS, "view"],
    [RESOURCES.GOODS_RECEIPT_NOTES, "view"],
  ]);
