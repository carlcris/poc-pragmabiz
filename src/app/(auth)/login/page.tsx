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
import { Package, BarChart3, Calendar } from "lucide-react";

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
  const [rememberMe, setRememberMe] = useState(false);

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
            fetch(`/api/rbac/users/${user.id}/permissions`),
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
            const { getFirstAccessiblePage } = await import("@/config/roleDefaultPages");
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
    <div className="flex min-h-screen bg-gradient-to-br from-[#f3e8ff] via-[#ede9fe] to-[#ddd6fe]">
      {/* Left Column - Branding & Illustration */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden">
        {/* Background decorative circles */}
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-purple-400/10"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 rounded-full bg-violet-400/10"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 rounded-full bg-purple-300/10"></div>

        <div className="w-full max-w-xl text-center relative z-10">
          {/* Illustration Container */}
          <div className="relative mb-12">
            <div className="relative mx-auto h-[450px] w-full max-w-[500px] flex items-center justify-center">
              {/* Main Character Image */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px]">
                <Image
                  src="/inv_man.png"
                  alt="Inventory Manager"
                  width={350}
                  height={350}
                  className="w-full h-full object-contain opacity-50 drop-shadow-2xl"
                  priority
                />
              </div>

              {/* Floating decorative elements */}
              <div className="absolute inset-0">
                {/* Top left area */}
                <div className="absolute left-[5%] top-[8%] animate-float-slow">
                  <div className="h-14 w-14 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center border border-purple-200">
                    <Package className="h-7 w-7 text-purple-600" />
                  </div>
                </div>

                {/* Top right area */}
                <div className="absolute right-[8%] top-[12%] animate-float-medium">
                  <div className="h-12 w-12 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center border border-violet-200">
                    <BarChart3 className="h-6 w-6 text-violet-500" />
                  </div>
                </div>

                {/* Bottom left */}
                <div className="absolute left-[10%] bottom-[15%] animate-float-fast">
                  <div className="h-16 w-16 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center border border-purple-200">
                    <Calendar className="h-7 w-7 text-purple-600" />
                  </div>
                </div>

                {/* Bottom right */}
                <div className="absolute right-[12%] bottom-[20%] animate-float-slow" style={{ animationDelay: '1s' }}>
                  <div className="px-4 py-2 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700">Stock Level</p>
                    <p className="text-xs text-gray-500">98.5%</p>
                  </div>
                </div>

                {/* Additional floating badges */}
                <div className="absolute right-[15%] top-[35%] animate-float-medium" style={{ animationDelay: '0.5s' }}>
                  <div className="px-3 py-1.5 rounded-lg bg-purple-100 border border-purple-200 shadow-md">
                    <p className="text-xs font-semibold text-purple-700">+2.5k Orders</p>
                  </div>
                </div>

                <div className="absolute left-[12%] top-[40%] animate-float-fast" style={{ animationDelay: '1.5s' }}>
                  <div className="px-3 py-1.5 rounded-lg bg-violet-100 border border-violet-200 shadow-md">
                    <p className="text-xs font-semibold text-violet-700">24/7 Active</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Branding Text */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-gray-800">Achlers Inventory System</h1>
            <p className="text-base text-gray-600 leading-relaxed">
              Unleash Your Business Success with Achlers
              <br />
              Integrated Inventory Management Platform
            </p>
          </div>

          {/* Pagination dots */}
          <div className="mt-8 flex justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-gray-400"></div>
            <div className="h-2 w-8 rounded-full bg-purple-600"></div>
            <div className="h-2 w-2 rounded-full bg-gray-300"></div>
            <div className="h-2 w-2 rounded-full bg-gray-300"></div>
          </div>
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 lg:p-12 bg-white/40 backdrop-blur-sm">
        <div className="w-full max-w-md">
          {/* Logo/Brand at top */}
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <Image
                src="/achlers_circle.png"
                alt="Achlers Logo"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">ACHLERS HUB</h2>
          </div>

          {/* Form Card */}
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-600">Username or email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="johnsmith007"
                          {...field}
                          disabled={isLoading}
                          className="h-12 w-full rounded-lg border-2 border-gray-200 bg-white px-4 text-base text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus-visible:ring-2 focus-visible:ring-purple-500/20"
                        />
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
                      <FormLabel className="text-sm font-medium text-gray-600">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••••••"
                          {...field}
                          disabled={isLoading}
                          className="h-12 w-full rounded-lg border-2 border-gray-200 bg-white px-4 text-base text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus-visible:ring-2 focus-visible:ring-purple-500/20"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-2 border-gray-300 text-purple-600 transition-all focus:ring-2 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <span className="text-sm font-medium text-gray-600 group-hover:text-gray-800">Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors underline"
                    onClick={() => alert('Contact your administrator for password reset')}
                  >
                    Forgot password?
                  </button>
                </div>

                {(loginError || error) && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-800">{loginError || error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 w-full rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 text-base font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:from-purple-700 hover:to-violet-700 hover:shadow-xl hover:shadow-purple-500/40"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </Form>

            {/* Powered by */}
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="text-center">
                <span className="text-xs text-gray-400 uppercase tracking-wide">Powered by</span>
              </div>
              <div className="flex items-center justify-center">
                <Image
                  src="/pragmatica.jpeg"
                  alt="Pragmatica"
                  width={200}
                  height={60}
                  className="h-14 w-auto object-contain opacity-70"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        @keyframes float-medium {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-15px) rotate(3deg);
          }
        }
        @keyframes float-fast {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }
        .animate-float-slow {
          animation: float-slow 4s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 3.5s ease-in-out infinite;
        }
        .animate-float-fast {
          animation: float-fast 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
