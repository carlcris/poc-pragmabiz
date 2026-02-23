import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { getUserPermissions } from "@/services/permissions/permissionResolver";
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { User as AppUser } from "@/types/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: userProfile } = await supabase
    .from("users")
    .select("company_id, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const firstName =
    (typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : "") ||
    userProfile?.first_name ||
    "";
  const lastName =
    (typeof user.user_metadata?.last_name === "string" ? user.user_metadata.last_name : "") ||
    userProfile?.last_name ||
    "";
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
    user.email ||
    "User";

  const initialUser: AppUser = {
    id: user.id,
    email: user.email || "",
    name: fullName,
    firstName,
    lastName,
    role: typeof user.user_metadata?.role === "string" ? user.user_metadata.role : "user",
    companyId: userProfile?.company_id || "",
  };

  const { supabase: buSupabase, currentBusinessUnitId } = await createServerClientWithBU();
  const initialPermissions = await getUserPermissions(user.id, currentBusinessUnitId ?? null);
  const initialPermissionScopeKey = `${user.id}:${currentBusinessUnitId ?? "all"}`;
  let initialBusinessUnitName: string | null = null;

  if (currentBusinessUnitId) {
    const { data: businessUnitRow } = await buSupabase
      .from("business_units")
      .select("name")
      .eq("id", currentBusinessUnitId)
      .maybeSingle();

    initialBusinessUnitName = businessUnitRow?.name ?? null;
  }

  return (
    <DashboardShell
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
