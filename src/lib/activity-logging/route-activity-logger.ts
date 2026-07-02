import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { captureSanitizedRequestPayload, sanitizeActivityData } from "./activity-data-sanitizer";
import { buildActivityPresentation } from "./activity-display-message";
import type {
  ActivityActorContext,
  ActivityContextOverride,
  ActivityHttpMethod,
  ActivitySource,
  JsonObject,
  RequestActivityEvent,
  RouteActivityConfig,
} from "./activity-log-types";

const MUTATION_METHODS = new Set<ActivityHttpMethod>(["POST", "PUT", "PATCH", "DELETE"]);
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActivityRequestStore = {
  contextOverride: ActivityContextOverride;
  requestId: string;
};

type RouteHandler = (...args: never[]) => unknown;

type RouteContextArgument = {
  params?: Promise<Record<string, string | string[]>> | Record<string, string | string[]>;
};

const activityRequestStorage = new AsyncLocalStorage<ActivityRequestStore>();

export function getActivityRequestId(): string | null {
  return activityRequestStorage.getStore()?.requestId ?? null;
}

export function setActivityContext(context: ActivityContextOverride): void {
  const store = activityRequestStorage.getStore();
  if (!store) {
    throw new Error("Activity context is only available inside a logged API route");
  }

  Object.assign(store.contextOverride, context);
}

function getRequestId(request: NextRequest): string {
  const suppliedRequestId = request.headers.get("x-request-id");
  return suppliedRequestId && REQUEST_ID_PATTERN.test(suppliedRequestId)
    ? suppliedRequestId
    : randomUUID();
}

function getBearerToken(request: NextRequest): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return undefined;
  return authorization.slice(7).trim() || undefined;
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}

function isExpectedAuthClaimsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const authError = error as { code?: unknown; message?: unknown; status?: unknown };
  const code = typeof authError.code === "string" ? authError.code : "";
  const message = typeof authError.message === "string" ? authError.message.toLowerCase() : "";

  return (
    code === "refresh_token_not_found" ||
    message.includes("jwt has expired") ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found")
  );
}

function readStringClaim(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function anonymousActorContext(): ActivityActorContext {
  return {
    actorType: "anonymous",
    actorLabel: null,
    userId: null,
    companyId: null,
    businessUnitId: null,
  };
}

async function resolveActorContext(request: NextRequest): Promise<ActivityActorContext> {
  try {
    const supabase = await createClient();
    const bearerToken = getBearerToken(request);
    const { data, error } = await (hasSupabaseAuthCookie(request)
      ? supabase.auth.getClaims()
      : supabase.auth.getClaims(bearerToken));

    if (error || !data?.claims) {
      return anonymousActorContext();
    }

    const claims = data.claims as Record<string, unknown>;
    const userId = readStringClaim(claims, "sub");
    if (!userId) {
      return anonymousActorContext();
    }

    return {
      actorType: "user",
      actorLabel: readStringClaim(claims, "actor_label") || readStringClaim(claims, "email"),
      userId,
      companyId: readStringClaim(claims, "company_id"),
      businessUnitId:
        readStringClaim(claims, "current_business_unit_id") ||
        readStringClaim(claims, "default_business_unit_id"),
    };
  } catch (error) {
    if (isExpectedAuthClaimsError(error)) {
      return anonymousActorContext();
    }

    console.error("Failed to resolve activity-log actor context", {
      error: error instanceof Error ? error.message : "Unknown actor-context error",
    });
    return anonymousActorContext();
  }
}

function resolveSource(request: NextRequest, route: string): ActivitySource {
  const declaredSource = request.headers.get("x-client-source")?.toLowerCase();
  if (
    declaredSource === "web" ||
    declaredSource === "mobile" ||
    declaredSource === "tablet" ||
    declaredSource === "api"
  ) {
    return declaredSource;
  }

  if (route.startsWith("/api/mobile/")) return "mobile";
  if (route.startsWith("/api/tablet/")) return "tablet";
  return request.headers.get("authorization") ? "api" : "web";
}

function getQueryParams(request: NextRequest): JsonObject {
  const params: Record<string, string | string[]> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    const current = params[key];
    if (current === undefined) params[key] = value;
    else if (Array.isArray(current)) current.push(value);
    else params[key] = [current, value];
  });
  return sanitizeActivityData(params) as JsonObject;
}

async function getRouteParams(args: unknown[]): Promise<JsonObject> {
  const context = args[1];
  if (!context || typeof context !== "object") return {};

  const params = await (context as RouteContextArgument).params;
  return params ? (sanitizeActivityData(params) as JsonObject) : {};
}

function getPrimaryEntityId(routeParams: JsonObject): string | null {
  const id = routeParams.id;
  if (typeof id === "string") return id;

  const firstValue = Object.values(routeParams).find((value) => typeof value === "string");
  return typeof firstValue === "string" ? firstValue : null;
}

function getRequestIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function startPayloadCapture(
  request: NextRequest,
  method: ActivityHttpMethod
): ReturnType<typeof captureSanitizedRequestPayload> {
  if (!MUTATION_METHODS.has(method)) {
    return Promise.resolve({ payload: null, metadata: {} });
  }

  try {
    return captureSanitizedRequestPayload(request.clone());
  } catch {
    return Promise.resolve({
      payload: { omitted: true, reason: "request-clone-failed" },
      metadata: { payloadReadFailed: true },
    });
  }
}

async function appendActivityEvent(event: RequestActivityEvent): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.rpc("append_user_activity_log", { p_event: event });
    if (error) throw error;
  } catch (error) {
    console.error("Failed to append user activity log", {
      requestId: event.request_id,
      route: event.route,
      action: event.action,
      error: error instanceof Error ? error.message : "Unknown activity-log error",
    });
  }
}

type PendingRequestActivity = {
  actorContextPromise: Promise<ActivityActorContext>;
  config: RouteActivityConfig;
  durationMs: number;
  method: ActivityHttpMethod;
  nextRequest: NextRequest;
  override: ActivityContextOverride;
  payloadPromise: ReturnType<typeof captureSanitizedRequestPayload>;
  requestId: string;
  responseStatus: number;
  routeParamsPromise: Promise<JsonObject>;
};

function scheduleActivityAppend(pendingActivity: PendingRequestActivity): void {
  try {
    after(async () => {
      try {
        const {
          actorContextPromise,
          config,
          durationMs,
          method,
          nextRequest,
          override,
          payloadPromise,
          requestId,
          responseStatus,
          routeParamsPromise,
        } = pendingActivity;
        const [actorContext, routeParams, payloadResult] = await Promise.all([
          actorContextPromise,
          routeParamsPromise,
          payloadPromise,
        ]);
        const userId = override.userId === undefined ? actorContext.userId : override.userId;
        const actorType = userId ? "user" : actorContext.actorType;
        const outcome = responseStatus < 400 ? "succeeded" : "failed";
        const actorLabel =
          override.actorLabel === undefined ? actorContext.actorLabel : override.actorLabel;
        const entityCode = override.entityCode?.slice(0, 100) || null;
        const entityLabel = override.entityLabel?.slice(0, 255) || null;
        const presentation = buildActivityPresentation({
          action: override.action || config.action,
          actorLabel,
          actorType,
          entityCode,
          entityLabel,
          httpStatus: responseStatus,
          outcome,
          resourceType: override.resourceType || config.resourceType,
        });

        await appendActivityEvent({
          occurred_at: new Date().toISOString(),
          request_id: requestId,
          event_kind: "request",
          actor_type: actorType,
          actor_label: actorLabel?.slice(0, 255) || null,
          user_id: userId ?? null,
          company_id:
            override.companyId === undefined ? actorContext.companyId : override.companyId,
          business_unit_id:
            override.businessUnitId === undefined
              ? actorContext.businessUnitId
              : override.businessUnitId,
          source: resolveSource(nextRequest, config.route),
          http_method: method,
          route: config.route,
          action: override.action || config.action,
          resource_type: override.resourceType || config.resourceType,
          entity_id: override.entityId || getPrimaryEntityId(routeParams),
          entity_ids: override.entityIds || null,
          entity_code: entityCode,
          entity_label: entityLabel,
          message_key: presentation.messageKey,
          display_message: presentation.displayMessage,
          route_params: routeParams,
          query_params: getQueryParams(nextRequest),
          request_payload: payloadResult.payload,
          outcome,
          http_status: responseStatus,
          duration_ms: durationMs,
          error_code: outcome === "failed" ? `HTTP_${responseStatus}` : null,
          ip_address: getRequestIp(nextRequest),
          user_agent: nextRequest.headers.get("user-agent")?.slice(0, 512) || null,
          metadata: {
            ...payloadResult.metadata,
            ...(override.metadata || {}),
          },
        });
      } catch (error) {
        console.error("Failed to prepare user activity log", {
          requestId: pendingActivity.requestId,
          route: pendingActivity.config.route,
          action: pendingActivity.config.action,
          error: error instanceof Error ? error.message : "Unknown activity-log preparation error",
        });
      }
    });
  } catch (error) {
    console.error("Failed to schedule user activity log", {
      requestId: pendingActivity.requestId,
      route: pendingActivity.config.route,
      action: pendingActivity.config.action,
      error: error instanceof Error ? error.message : "Unknown activity-log scheduling error",
    });
  }
}

export function withActivityLogging<THandler extends RouteHandler>(
  handler: THandler,
  config: RouteActivityConfig
): (...args: Parameters<THandler>) => Promise<Awaited<ReturnType<THandler>>> {
  return async (...args: Parameters<THandler>): Promise<Awaited<ReturnType<THandler>>> => {
    const request = args[0] as unknown;
    if (!(request instanceof Request)) {
      return (await handler(...args)) as Awaited<ReturnType<THandler>>;
    }

    const nextRequest = request as NextRequest;
    const method = nextRequest.method.toUpperCase() as ActivityHttpMethod;
    const requestId = getRequestId(nextRequest);
    const startedAt = performance.now();
    const actorContextPromise = resolveActorContext(nextRequest);
    const routeParamsPromise = getRouteParams(args as unknown[]);
    const payloadPromise = startPayloadCapture(nextRequest, method);
    const store: ActivityRequestStore = { requestId, contextOverride: {} };

    return (await activityRequestStorage.run(store, async () => {
      let responseStatus = 500;

      try {
        const response = (await handler(...args)) as Awaited<ReturnType<THandler>>;
        if (response instanceof Response) {
          responseStatus = response.status;
          try {
            response.headers.set("x-request-id", requestId);
          } catch {
            // Some framework responses expose immutable headers.
          }
        }

        return response;
      } finally {
        scheduleActivityAppend({
          actorContextPromise,
          config,
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          method,
          nextRequest,
          override: { ...store.contextOverride },
          payloadPromise,
          requestId,
          responseStatus,
          routeParamsPromise,
        });
      }
    })) as Awaited<ReturnType<THandler>>;
  };
}
