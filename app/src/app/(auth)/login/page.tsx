"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { useAuthStore } from "@/stores/authStore";
import type { Resource } from "@/constants/resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type RoleSummary = {
  id: string;
  name: string;
  description: string | null;
  business_unit_id: string | null;
  business_unit_name: string;
};

type RolesResponse = {
  data: RoleSummary[];
};

type PermissionEntry = {
  resource: Resource;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type PermissionsResponse = {
  data: {
    userId: string;
    businessUnitId: string | null;
    permissions: PermissionEntry[];
  };
};

type UserPermissions = Record<Resource, Omit<PermissionEntry, "resource">>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, setLoading } = useAuthStore();
  const [loginError, setLoginError] = useState<string | null>(null);

  // Set loading to false when login page mounts
  useEffect(() => {
    setLoading(false);
  }, [setLoading]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setLoginError(null);
      await login(data);

      // SECURITY: Fetch user permissions to determine accessible landing page
      const user = useAuthStore.getState().user;
      if (user?.id) {
        try {
          // Fetch both roles and permissions in parallel
          const [rolesResponse, permissionsResponse] = await Promise.all([
            fetch(`/api/rbac/users/${user.id}/roles`),
            fetch(`/api/rbac/users/${user.id}/permissions`)
          ]);

          if (rolesResponse.ok && permissionsResponse.ok) {
            const rolesPayload = (await rolesResponse.json()) as RolesResponse;
            const permissionsPayload = (await permissionsResponse.json()) as PermissionsResponse;

            // Transform permissions array to object
            const permissions = permissionsPayload.data.permissions.reduce<UserPermissions>(
              (acc, perm) => {
                acc[perm.resource] = {
                  can_view: perm.can_view,
                  can_create: perm.can_create,
                  can_edit: perm.can_edit,
                  can_delete: perm.can_delete,
                };
                return acc;
              },
              {} as UserPermissions
            );

            // Get first accessible page based on permissions
            const roleNames = rolesPayload.data.map((role) => role.name);
            const { getFirstAccessiblePage } = await import('@/config/roleDefaultPages');
            const landingPage = getFirstAccessiblePage(permissions, roleNames);

            router.push(landingPage);
            return;
          }
        } catch {
          // Fall through to 403 redirect
        }
      }

      // Fallback to 403 if permission fetch fails
      router.push("/403");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-sky-100/70 via-sky-200/40 to-white/90" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
        <div className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      </div>
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/80 shadow-[0_30px_70px_rgba(37,99,235,0.18)] backdrop-blur-2xl">
          <CardHeader className="space-y-6 pb-2 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-slate-900/10">
              <Image
                src="/achlers_circle.png"
                alt="Achlers Logo"
                width={84}
                height={84}
                priority
                className="object-contain"
              />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-semibold text-slate-900">
                Sign in with email
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Access your inventory workspace, orders, and reports in one place.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="email"
                            placeholder="Email"
                            {...field}
                            disabled={isLoading}
                            className="h-12 rounded-full border-slate-200 bg-slate-50/80 pl-11 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="password"
                            placeholder="Password"
                            {...field}
                            disabled={isLoading}
                            className="h-12 rounded-full border-slate-200 bg-slate-50/80 pl-11 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(loginError || error) && (
                  <Alert variant="destructive">
                    <AlertDescription>{loginError || error}</AlertDescription>
                  </Alert>
                )}

                <div className="text-right text-xs text-slate-500">
                  Forgot password? Contact your administrator.
                </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-full"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Get Started"}
            </Button>
              </form>
            </Form>
            <div className="mt-6 flex flex-col items-center gap-2 text-xs text-slate-400">
              <span className="uppercase tracking-[0.2em]">Powered by</span>
              <div className="flex items-center justify-center rounded-full bg-transparent px-2 py-1">
                <Image
                  src="/pragmatica.jpeg"
                  alt="Pragmatica"
                  width={280}
                  height={80}
                  className="h-16 w-auto object-contain"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
