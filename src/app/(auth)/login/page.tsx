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
import { User, Lock, Package, BarChart3, Calendar } from "lucide-react";

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
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 animate-gradient-shift bg-gradient-to-br from-[#667eea] via-[#764ba2] via-[#f093fb] via-[#4facfe] to-[#00f2fe] bg-[length:400%_400%]" />

      {/* Floating Background Shapes */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[10%] h-[300px] w-[300px] animate-float-slow rounded-full bg-white/10" />
        <div className="absolute bottom-[15%] right-[15%] h-[200px] w-[200px] animate-float-medium rounded-full bg-white/10" />
        <div className="absolute left-[5%] top-[60%] h-[150px] w-[150px] animate-float-fast rounded-full bg-white/10" />
      </div>

      {/* Left Column - Welcome Section (Hidden on mobile) */}
      <div className="relative hidden flex-1 items-center justify-center p-12 lg:flex">
        <div className="z-10 w-full max-w-2xl animate-fade-in-left text-center text-white">
          <div className="mx-auto mb-10 flex h-36 w-36 items-center justify-center rounded-[32px] bg-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-md">
            <Image
              src="/achlers_circle.png"
              alt="Achlers Logo"
              width={100}
              height={100}
              priority
              className="object-contain"
            />
          </div>

          <h2 className="mb-3 text-3xl font-extrabold leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
            Achlers Integrated Inventory System
          </h2>
          <p className="mb-8 text-base opacity-95">
            Manage inventory, track orders, and grow your business effortlessly
          </p>

          {/* Warehouse Illustration */}
          <div className="relative mx-auto h-[400px] w-full max-w-[500px]">
            <div className="relative flex h-full items-center justify-center">
              <div className="relative h-[300px] w-[300px] animate-warehouse-float" style={{ transformStyle: 'preserve-3d' }}>
                {/* Main Warehouse Box */}
                <div className="absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 animate-pulse-slow rounded-xl border-2 border-white/30 bg-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.2)] backdrop-blur-md">
                  <Package className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-white/60" />
                </div>
                {/* Additional Boxes */}
                <div className="absolute left-[10%] top-[20%] h-[90px] w-[90px] animate-pulse-medium rounded-xl border-2 border-white/30 bg-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.2)] backdrop-blur-md" />
                <div className="absolute bottom-[15%] right-[15%] h-[80px] w-[80px] animate-pulse-fast rounded-xl border-2 border-white/30 bg-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.2)] backdrop-blur-md" />

                {/* Floating Icons */}
                <div className="absolute right-[20%] top-[10%] flex h-10 w-10 animate-float-icon-1 items-center justify-center rounded-lg border border-white/30 bg-white/25 backdrop-blur-sm">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div className="absolute bottom-[20%] left-[15%] flex h-10 w-10 animate-float-icon-2 items-center justify-center rounded-lg border border-white/30 bg-white/25 backdrop-blur-sm">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="absolute right-[10%] top-[40%] flex h-10 w-10 animate-float-icon-3 items-center justify-center rounded-lg border border-white/30 bg-white/25 backdrop-blur-sm">
                  <Package className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="relative flex flex-1 items-center justify-center bg-white/5 p-6 backdrop-blur-[10px] lg:p-12">
        <div className="w-full max-w-[380px] animate-slide-in rounded-[28px] bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="mb-1 text-xl font-bold text-black">Sign in with email</h1>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                        <Input
                          type="email"
                          placeholder="Email"
                          {...field}
                          disabled={isLoading}
                          className="h-12 w-full rounded-xl border-none bg-gray-100 pl-11 pr-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus-visible:ring-0"
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
                        <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                        <Input
                          type="password"
                          placeholder="Password"
                          {...field}
                          disabled={isLoading}
                          className="h-12 w-full rounded-xl border-none bg-gray-100 pl-11 pr-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus-visible:ring-0"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-black focus:ring-2 focus:ring-black focus:ring-offset-0"
                  />
                  <span className="text-xs font-medium text-gray-900">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-gray-900 transition-colors hover:text-gray-600"
                  onClick={() => alert('Contact your administrator for password reset')}
                >
                  Forgot password?
                </button>
              </div>

              {(loginError || error) && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{loginError || error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-10 h-12 w-full rounded-xl bg-black text-sm font-semibold text-white transition-all hover:bg-gray-800"
              >
                {isLoading ? "Signing in..." : "Get Started"}
              </Button>
            </form>
          </Form>

          {/* Powered by */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <span className="text-sm font-semibold uppercase tracking-wider text-gray-500">Powered by</span>
            <div className="flex items-center justify-center">
              <Image
                src="/pragmatica.jpeg"
                alt="Pragmatica"
                width={280}
                height={84}
                className="h-20 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Custom Animations Styles */}
      <style jsx>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-30px) rotate(5deg); }
          66% { transform: translateY(30px) rotate(-5deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-20px) rotate(3deg); }
          66% { transform: translateY(20px) rotate(-3deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-15px) rotate(2deg); }
          66% { transform: translateY(15px) rotate(-2deg); }
        }
        @keyframes fade-in-left {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes warehouse-float {
          0%, 100% { transform: translateY(0px) rotateX(10deg) rotateY(-20deg); }
          50% { transform: translateY(-20px) rotateX(10deg) rotateY(-20deg); }
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes pulse-medium {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes pulse-fast {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes float-icon-1 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes float-icon-2 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes float-icon-3 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        .animate-gradient-shift {
          animation: gradient-shift 15s ease infinite;
        }
        .animate-float-slow {
          animation: float-slow 20s infinite ease-in-out;
        }
        .animate-float-medium {
          animation: float-medium 20s infinite ease-in-out 5s;
        }
        .animate-float-fast {
          animation: float-fast 20s infinite ease-in-out 10s;
        }
        .animate-fade-in-left {
          animation: fade-in-left 0.8s ease-out 0.2s both;
        }
        .animate-slide-in {
          animation: slide-in 0.6s ease-out;
        }
        .animate-warehouse-float {
          animation: warehouse-float 6s ease-in-out infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        .animate-pulse-medium {
          animation: pulse-medium 3s ease-in-out infinite 0.5s;
        }
        .animate-pulse-fast {
          animation: pulse-fast 3s ease-in-out infinite 1s;
        }
        .animate-float-icon-1 {
          animation: float-icon-1 4s ease-in-out infinite;
        }
        .animate-float-icon-2 {
          animation: float-icon-2 4s ease-in-out infinite 1s;
        }
        .animate-float-icon-3 {
          animation: float-icon-3 4s ease-in-out infinite 2s;
        }
      `}</style>
    </div>
  );
}
