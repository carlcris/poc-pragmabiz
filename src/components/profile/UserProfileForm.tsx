"use client";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useUpdateUserProfile } from "@/hooks/useUserProfile";
import { createUserProfileSchema, type UserProfileFormData } from "@/lib/validations/user-profile";
import type { UserProfile } from "@/types/user-profile";

type UserProfileFormProps = {
  profile: UserProfile;
};

export function UserProfileForm({ profile }: UserProfileFormProps) {
  const t = useTranslations("profilePage");
  const updateProfile = useUpdateUserProfile();

  const form = useForm<UserProfileFormData>({
    resolver: zodResolver(
      createUserProfileSchema({
        firstNameRequired: t("firstNameRequired"),
        firstNameTooLong: t("firstNameTooLong"),
        lastNameTooLong: t("lastNameTooLong"),
        phoneTooLong: t("phoneTooLong"),
      })
    ),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
    },
  });

  const onSubmit = async (data: UserProfileFormData) => {
    try {
      const saved = await updateProfile.mutateAsync(data);
      form.reset(saved);
      toast.success(t("saveSuccess"));
    } catch {
      toast.error(t("saveError"));
    }
  };

  const isSaving = updateProfile.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("personalTitle")}</CardTitle>
        <CardDescription>{t("personalDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("firstName")}</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="given-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lastName")}</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="family-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("phone")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" autoComplete="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("saveChanges")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
