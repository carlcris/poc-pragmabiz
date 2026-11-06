import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PasswordChangeErrorCode } from "@/lib/auth/password-change-errors";
import { passwordChangeRequestSchema } from "@/lib/validations/password-change";

const errorMessages: Record<PasswordChangeErrorCode, string> = {
  PASSWORD_CHANGE_INVALID_INPUT: "Invalid password details",
  PASSWORD_CHANGE_CURRENT_INCORRECT: "Current password is incorrect",
  PASSWORD_CHANGE_SAME_PASSWORD: "New password must be different from the current password",
  PASSWORD_CHANGE_WEAK_PASSWORD: "New password does not meet the password requirements",
  PASSWORD_CHANGE_RATE_LIMITED: "Too many attempts. Please wait and try again",
  PASSWORD_CHANGE_UNAVAILABLE: "Password could not be changed. Please try again",
};

// Status 401 is reserved for an invalid session; the client signs the user out on it.
function passwordChangeErrorResponse(code: PasswordChangeErrorCode, status: number) {
  return NextResponse.json({ error: errorMessages[code], code }, { status });
}

function classifyAuthError(error: { code?: string; status?: number }) {
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return passwordChangeErrorResponse("PASSWORD_CHANGE_RATE_LIMITED", 429);
  }
  if (error.code === "same_password") {
    return passwordChangeErrorResponse("PASSWORD_CHANGE_SAME_PASSWORD", 400);
  }
  if (error.code === "weak_password") {
    return passwordChangeErrorResponse("PASSWORD_CHANGE_WEAK_PASSWORD", 400);
  }
  return passwordChangeErrorResponse("PASSWORD_CHANGE_UNAVAILABLE", 503);
}

// Verifies the current password on a stateless client so the caller's session cookies are
// untouched, then revokes the short-lived verification session it created.
async function verifyCurrentPassword(email: string, password: string) {
  const verificationClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

  const { error } = await verificationClient.auth.signInWithPassword({ email, password });
  if (error) return error;

  const { error: revokeError } = await verificationClient.auth.signOut({ scope: "local" });
  if (revokeError) {
    console.error("Failed to revoke password verification session", {
      code: revokeError.code,
      status: revokeError.status,
    });
  }
  return null;
}

// POST /api/auth/change-password - Change the signed-in user's password
async function POSTHandler(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = passwordChangeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return passwordChangeErrorResponse("PASSWORD_CHANGE_INVALID_INPUT", 400);
    }

    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      return passwordChangeErrorResponse("PASSWORD_CHANGE_SAME_PASSWORD", 400);
    }

    const verificationError = await verifyCurrentPassword(user.email, currentPassword);
    if (verificationError) {
      if (verificationError.code === "invalid_credentials") {
        return passwordChangeErrorResponse("PASSWORD_CHANGE_CURRENT_INCORRECT", 400);
      }
      console.error("Current password verification failed", {
        code: verificationError.code,
        status: verificationError.status,
      });
      return classifyAuthError(verificationError);
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      console.error("Password update failed", {
        code: updateError.code,
        status: updateError.status,
      });
      return classifyAuthError(updateError);
    }

    // Sign out every other session; the password change is already committed if this fails.
    const { error: signOutOthersError } = await supabase.auth.signOut({ scope: "others" });
    if (signOutOthersError) {
      console.error("Failed to sign out other sessions after password change", {
        code: signOutOthersError.code,
        status: signOutOthersError.status,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error changing password", error);
    return passwordChangeErrorResponse("PASSWORD_CHANGE_UNAVAILABLE", 500);
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "update",
  resourceType: "auth",
  route: "/api/auth/change-password",
});
