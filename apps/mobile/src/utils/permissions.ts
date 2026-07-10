import type { AuthSession, PermissionAction, ResourcePermission } from "@/contracts/auth";

const permissionFlag = (action: PermissionAction): keyof ResourcePermission => {
  switch (action) {
    case "view":
      return "can_view";
    case "create":
      return "can_create";
    case "edit":
      return "can_edit";
    case "delete":
      return "can_delete";
  }
};

export const hasResourcePermission = (
  session: AuthSession | null | undefined,
  resource: string,
  action: PermissionAction
) => Boolean(session?.permissions[resource]?.[permissionFlag(action)]);

export const hasCapability = (
  session: AuthSession | null | undefined,
  capability: string,
  action: PermissionAction
) => Boolean(session?.capabilities[capability]?.[permissionFlag(action)]);

export const canAccessReceiving = (session: AuthSession | null | undefined) =>
  hasResourcePermission(session, "load_lists", "view") &&
  hasResourcePermission(session, "goods_receipt_notes", "view");

export const canAccessPicking = (session: AuthSession | null | undefined) =>
  hasResourcePermission(session, "stock_requests", "view");

export const canSaveGrnReceiving = (session: AuthSession | null | undefined) =>
  hasCapability(session, "goods_receipt_notes.operation.save_receiving.edit", "edit");

export const canSubmitGrnReceiving = (session: AuthSession | null | undefined) =>
  hasCapability(session, "goods_receipt_notes.operation.submit_receiving.edit", "edit");
