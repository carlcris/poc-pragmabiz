"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { useAuthStore } from "@/stores/authStore";
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

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
            const { data: roles } = await rolesResponse.json();
            const { data: permissionsData } = await permissionsResponse.json();

            // Transform permissions array to object
            const permissions: any = {};
            permissionsData.permissions.forEach((perm: any) => {
              permissions[perm.resource] = {
                can_view: perm.can_view,
                can_create: perm.can_create,
                can_edit: perm.can_edit,
                can_delete: perm.can_delete,
              };
            });

            // Get first accessible page based on permissions
            const roleNames = roles.map((r: any) => r.name);
            const { getFirstAccessiblePage } = await import('@/config/roleDefaultPages');
            const landingPage = getFirstAccessiblePage(permissions, roleNames);

            router.push(landingPage);
            return;
          }
        } catch (error) {

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
    <Card>
      <CardHeader className="space-y-6">
        <div className="flex flex-col items-center space-y-3">
          <Image
            src="/erp.png"
            alt="ERP Logo"
            width={120}
            height={120}
            priority
            className="object-contain"
          />
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              PragmaBiz
            </h1>
            <p className="text-sm text-muted-foreground font-medium">
              Enterprise Resource Planning System
            </p>
          </div>
        </div>
        <div className="space-y-1 text-center pt-2">
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="admin@erp.com"
                      {...field}
                      disabled={isLoading}
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      {...field}
                      disabled={isLoading}
                    />
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
