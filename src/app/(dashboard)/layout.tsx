import { redirect } from "next/navigation";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { getUserPermissions } from "@/services/permissions/permissionResolver";
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { BusinessUnitWithAccess } from "@/types/business-unit";
import type { User as AppUser } from "@/types/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, authError, session, currentBusinessUnitId, sessionBusinessUnitId } =
    await createServerClientWithBU();

  if (authError || !user) {
    redirect("/login");
  }

  const [profileResult, initialPermissions, businessUnitResult] = await Promise.all([
    supabase
      .from("users")
      .select("company_id, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle(),
    getUserPermissions(user.id, currentBusinessUnitId ?? null),
    currentBusinessUnitId
      ? supabase
          .from("user_business_unit_access")
          .select(
            `role, is_default, business_units!inner (
            id, company_id, code, name, type, is_active,
            created_at, created_by, updated_at, updated_by
          )`
          )
          .eq("user_id", user.id)
          .eq("business_unit_id", currentBusinessUnitId)
          .eq("business_units.is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const userProfile = profileResult.data;
  const access = businessUnitResult.data as {
    role: BusinessUnitWithAccess["access"]["role"];
    is_default: boolean;
    business_units: Omit<BusinessUnitWithAccess, "access">;
  } | null;
  const initialBusinessUnit: BusinessUnitWithAccess | null = access
    ? { ...access.business_units, access: { role: access.role, is_default: access.is_default } }
    : null;
  const initialBusinessUnitName = initialBusinessUnit?.name ?? null;
  const initialPermissionScopeKey = `${user.id}:${currentBusinessUnitId ?? "all"}`;

  const firstName = userProfile?.first_name ?? "";
  const lastName = userProfile?.last_name ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || user.email || "User";

  const initialUser: AppUser = {
    id: user.id,
    email: user.email || "",
    name: fullName,
    firstName,
    lastName,
    role: typeof user.user_metadata?.role === "string" ? user.user_metadata.role : "user",
    companyId: userProfile?.company_id || "",
  };

  return (
    <DashboardShell
      initialBusinessUnit={initialBusinessUnit}
      initialBusinessUnitId={currentBusinessUnitId ?? null}
      sessionBusinessUnitId={sessionBusinessUnitId}
      initialUser={initialUser}
      initialToken={session?.access_token ?? null}
      initialPermissions={initialPermissions}
      initialPermissionScopeKey={initialPermissionScopeKey}
      initialBusinessUnitName={initialBusinessUnitName}
    >
      {children}
    </DashboardShell>
  );
}
