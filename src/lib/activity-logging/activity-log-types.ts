export type ActivityActorType = "user" | "system" | "anonymous";

export type ActivitySource = "web" | "mobile" | "tablet" | "api" | "system";

export type ActivityOutcome = "succeeded" | "failed";

export type ActivityHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export type JsonObject = { [key: string]: JsonValue };

export type RouteActivityConfig = {
  action: string;
  resourceType: string;
  route: string;
};

export type ActivityPresentation = {
  displayMessage: string;
  messageKey: string;
};

export type ActivityContextOverride = {
  action?: string;
  actorLabel?: string | null;
  businessUnitId?: string | null;
  companyId?: string | null;
  entityId?: string | null;
  entityIds?: string[];
  entityCode?: string | null;
  entityLabel?: string | null;
  metadata?: JsonObject;
  resourceType?: string;
  userId?: string | null;
};

export type ActivityActorContext = {
  actorLabel: string | null;
  actorType: ActivityActorType;
  businessUnitId: string | null;
  companyId: string | null;
  userId: string | null;
};

export type RequestActivityEvent = {
  action: string;
  actor_type: ActivityActorType;
  actor_label: string | null;
  business_unit_id: string | null;
  company_id: string | null;
  duration_ms: number;
  entity_id: string | null;
  entity_ids: string[] | null;
  entity_code: string | null;
  entity_label: string | null;
  error_code: string | null;
  event_kind: "request";
  http_method: ActivityHttpMethod;
  http_status: number;
  ip_address: string | null;
  display_message: string;
  metadata: JsonObject;
  message_key: string;
  occurred_at: string;
  outcome: ActivityOutcome;
  query_params: JsonObject;
  request_id: string;
  request_payload: JsonValue | null;
  resource_type: string;
  route: string;
  route_params: JsonObject;
  source: ActivitySource;
  user_agent: string | null;
  user_id: string | null;
};
