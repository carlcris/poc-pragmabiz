import type { LoadList, LoadListStatus } from "@/types/load-list";

const EDITABLE_LOAD_LIST_STATUSES: readonly LoadListStatus[] = ["draft", "confirmed"];

type LoadListEditabilityInput = Pick<LoadList, "status" | "isSourceBusinessUnit" | "capabilities">;

// Editing rewrites every line price, so it also requires unit price visibility.
export const canEditLoadList = (loadList: LoadListEditabilityInput, canEditResource: boolean) =>
  canEditResource &&
  loadList.isSourceBusinessUnit &&
  EDITABLE_LOAD_LIST_STATUSES.includes(loadList.status) &&
  loadList.capabilities?.canViewUnitPrice === true;
