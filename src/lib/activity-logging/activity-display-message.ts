import type {
  ActivityActorType,
  ActivityOutcome,
  ActivityPresentation,
} from "./activity-log-types";

type BuildActivityPresentationInput = {
  action: string;
  actorLabel: string | null;
  actorType: ActivityActorType;
  entityCode: string | null;
  entityLabel: string | null;
  httpStatus: number;
  outcome: ActivityOutcome;
  resourceType: string;
};

const COLLECTION_LABELS: Record<string, string> = {
  accounts_receivable_aging: "accounts receivable aging report",
  commission: "commission report",
  dashboard: "dashboard",
  inventory: "inventory report",
  item_location_batch: "item location and batch report",
  ledger: "ledger",
  picking_efficiency: "picking efficiency report",
  pos: "POS transactions",
  product_movement: "product movement report",
  shipments: "shipments report",
  stock_aging: "stock aging report",
  stock_ledger: "stock ledger",
  stock_movement: "stock movement report",
  stock_valuation: "stock valuation report",
  transformation_efficiency: "transformation efficiency report",
  trial_balance: "trial balance",
  warehouse_dashboard: "warehouse dashboard",
};

const SINGULAR_RESOURCE_LABELS: Record<string, string> = {
  pos: "POS transaction",
};

const ACTION_PHRASES: Record<string, { infinitive: string; past: string; suffix?: string }> = {
  accept: { infinitive: "accept", past: "accepted" },
  acknowledge: { infinitive: "acknowledge", past: "acknowledged" },
  approve: { infinitive: "approve", past: "approved" },
  assign_permission: { infinitive: "assign permission to", past: "assigned permission to" },
  assign_role: { infinitive: "assign a role to", past: "assigned a role to" },
  cancel: { infinitive: "cancel", past: "canceled" },
  change_status: { infinitive: "change the status of", past: "changed the status of" },
  clear_cache: { infinitive: "clear the cache for", past: "cleared the cache for" },
  complete: { infinitive: "complete", past: "completed" },
  confirm: { infinitive: "confirm", past: "confirmed" },
  convert_to_invoice: { infinitive: "convert", past: "converted", suffix: " to an invoice" },
  create: { infinitive: "create", past: "created" },
  create_frame_job_order: {
    infinitive: "create a frame job order for",
    past: "created a frame job order for",
  },
  delete: { infinitive: "delete", past: "deleted" },
  dispatch: { infinitive: "dispatch", past: "dispatched" },
  execute: { infinitive: "execute", past: "executed" },
  link_requisitions: { infinitive: "link requisitions to", past: "linked requisitions to" },
  mark_dispatch_ready: {
    infinitive: "mark",
    past: "marked",
    suffix: " as ready for dispatch",
  },
  mark_picked: { infinitive: "mark", past: "marked", suffix: " as picked" },
  mark_read: { infinitive: "mark", past: "marked", suffix: " as read" },
  pick: { infinitive: "pick", past: "picked" },
  post: { infinitive: "post", past: "posted" },
  process_payment: { infinitive: "process payment for", past: "processed payment for" },
  push_to_production: {
    infinitive: "push",
    past: "pushed",
    suffix: " to production",
  },
  queue_picking: { infinitive: "queue", past: "queued", suffix: " for picking" },
  receive: { infinitive: "receive", past: "received" },
  receive_all: { infinitive: "receive all items for", past: "received all items for" },
  receive_direct_pickup: {
    infinitive: "receive direct pickup for",
    past: "received direct pickup for",
  },
  reject: { infinitive: "reject", past: "rejected" },
  release: { infinitive: "release", past: "released" },
  remove_permission: { infinitive: "remove permission from", past: "removed permission from" },
  remove_role: { infinitive: "remove a role from", past: "removed a role from" },
  send: { infinitive: "send", past: "sent" },
  start_picking: { infinitive: "start picking", past: "started picking" },
  start_receiving: { infinitive: "start receiving", past: "started receiving" },
  submit: { infinitive: "submit", past: "submitted" },
  submit_receiving: { infinitive: "submit receiving for", past: "submitted receiving for" },
  unacknowledge: { infinitive: "unacknowledge", past: "unacknowledged" },
  update: { infinitive: "update", past: "updated" },
  verify_admin_pin: {
    infinitive: "verify an administrator PIN for",
    past: "verified an administrator PIN for",
  },
  view: { infinitive: "view", past: "viewed" },
  void: { infinitive: "void", past: "voided" },
};

function getActorLabel(actorType: ActivityActorType, actorLabel: string | null): string {
  if (actorLabel) return actorLabel.slice(0, 255);
  if (actorType === "system") return "System";
  if (actorType === "anonymous") return "An anonymous user";
  return "A user";
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").trim();
}

function singularizeResource(resourceType: string): string {
  const explicitLabel = SINGULAR_RESOURCE_LABELS[resourceType];
  if (explicitLabel) return explicitLabel;

  const resource = humanize(resourceType);
  if (resource.endsWith("ies")) return `${resource.slice(0, -3)}y`;
  if (resource.endsWith("s") && !resource.endsWith("ss")) return resource.slice(0, -1);
  return resource;
}

function getTarget(
  resourceType: string,
  entityCode: string | null,
  entityLabel: string | null
): string {
  const resource = singularizeResource(resourceType);
  if (entityCode && entityLabel) return `${resource} ${entityCode} (${entityLabel})`;
  if (entityCode) return `${resource} ${entityCode}`;
  if (entityLabel) return `${resource} ${entityLabel}`;
  return `the ${resource}`;
}

function buildAuthenticationMessage(
  actor: string,
  action: string,
  outcome: ActivityOutcome,
  resourceType: string,
  httpStatus: number
): string | null {
  if (action === "login")
    return outcome === "succeeded" ? `${actor} logged in.` : "A login attempt failed.";
  if (action === "logout")
    return outcome === "succeeded"
      ? `${actor} logged out.`
      : `${actor} attempted to log out, but the action failed.`;
  if (action === "refresh_session")
    return outcome === "succeeded"
      ? `${actor} refreshed the session.`
      : `${actor} attempted to refresh the session, but the action failed.`;
  if (action === "set_session")
    return outcome === "succeeded"
      ? `${actor} established a session.`
      : "A session could not be established.";
  if (action === "switch_business_unit")
    return outcome === "succeeded"
      ? `${actor} switched business-unit context.`
      : `${actor} attempted to switch business-unit context, but the action failed.`;
  if (action === "register") {
    if (outcome === "succeeded") return `${actor} registered an account.`;
    if (httpStatus === 401 || httpStatus === 403) return "A registration attempt was denied.";
    return "A registration attempt failed.";
  }
  if (action === "verify_admin_pin")
    return outcome === "succeeded"
      ? `${actor} verified an administrator PIN.`
      : `${actor} attempted to verify an administrator PIN, but the action failed.`;
  if (resourceType === "auth" && action === "view")
    return outcome === "succeeded"
      ? `${actor} viewed account session details.`
      : `${actor} attempted to view account session details, but the action failed.`;
  return null;
}

export function buildActivityPresentation(
  input: BuildActivityPresentationInput
): ActivityPresentation {
  const actor = getActorLabel(input.actorType, input.actorLabel);
  const result = input.httpStatus === 401 || input.httpStatus === 403 ? "denied" : input.outcome;
  const messageKey = `activity.${input.resourceType}.${input.action}.${result}`.slice(0, 160);
  const authenticationMessage = buildAuthenticationMessage(
    actor,
    input.action,
    input.outcome,
    input.resourceType,
    input.httpStatus
  );
  if (authenticationMessage) {
    return { messageKey, displayMessage: authenticationMessage.slice(0, 1000) };
  }

  if (input.action === "navigate") {
    const page = input.entityLabel || humanize(input.resourceType);
    const displayMessage =
      input.outcome === "succeeded"
        ? `${actor} viewed the ${page} page.`
        : `${actor} attempted to view the ${page} page, but the action failed.`;
    return { messageKey, displayMessage: displayMessage.slice(0, 1000) };
  }

  if (input.action === "list") {
    const resource =
      COLLECTION_LABELS[input.resourceType] || `${humanize(input.resourceType)} list`;
    const displayMessage =
      input.outcome === "succeeded"
        ? `${actor} viewed the ${resource}.`
        : `${actor} attempted to view the ${resource}, but the action failed.`;
    return { messageKey, displayMessage: displayMessage.slice(0, 1000) };
  }

  if (input.action === "search") {
    const resource = humanize(input.resourceType);
    const displayMessage =
      input.outcome === "succeeded"
        ? `${actor} searched ${resource}.`
        : `${actor} attempted to search ${resource}, but the action failed.`;
    return { messageKey, displayMessage: displayMessage.slice(0, 1000) };
  }

  const phrase = ACTION_PHRASES[input.action] || {
    infinitive: humanize(input.action),
    past: humanize(input.action),
  };
  const target = getTarget(input.resourceType, input.entityCode, input.entityLabel);
  const infinitiveAction = `${phrase.infinitive} ${target}${phrase.suffix || ""}`;
  const pastAction = `${phrase.past} ${target}${phrase.suffix || ""}`;
  let displayMessage: string;

  if (input.httpStatus === 401) {
    displayMessage = `${actor} was not authenticated to ${infinitiveAction}.`;
  } else if (input.httpStatus === 403) {
    displayMessage = `${actor} was denied permission to ${infinitiveAction}.`;
  } else if (input.outcome === "failed") {
    displayMessage = `${actor} attempted to ${infinitiveAction}, but the action failed.`;
  } else {
    displayMessage = `${actor} ${pastAction}.`;
  }

  return { messageKey, displayMessage: displayMessage.slice(0, 1000) };
}
