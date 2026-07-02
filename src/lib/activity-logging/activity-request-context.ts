import { AsyncLocalStorage } from "node:async_hooks";
import type { ActivityContextOverride } from "./activity-log-types";

export type ActivityRequestStore = {
  contextOverride: ActivityContextOverride;
  requestId: string;
  shouldResolveActorLabel: boolean;
};

export const activityRequestStorage = new AsyncLocalStorage<ActivityRequestStore>();

export function getActivityRequestId(): string | null {
  return activityRequestStorage.getStore()?.requestId ?? null;
}

export function shouldResolveActivityActorLabel(): boolean {
  return activityRequestStorage.getStore()?.shouldResolveActorLabel ?? false;
}

export function setActivityContext(context: ActivityContextOverride): void {
  const store = activityRequestStorage.getStore();
  if (!store) {
    throw new Error("Activity context is only available inside a logged API route");
  }

  Object.assign(store.contextOverride, context);
}

export function setActivityContextIfAvailable(context: ActivityContextOverride): void {
  const store = activityRequestStorage.getStore();
  if (!store) return;

  Object.assign(store.contextOverride, context);
}
