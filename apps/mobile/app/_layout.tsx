import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomNav } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  const { session, isRestoring, restore } = useAuthStore();
  const segments = useSegments();

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (isRestoring) return;
    const inLogin = segments[0] === "login";
    if (!session && !inLogin) router.replace("/login");
    if (session && inLogin) router.replace("/");
  }, [isRestoring, segments, session]);

  if (isRestoring) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  const showBottomNav = session && segments[0] !== "login";

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade",
              animationDuration: 200
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                animation: "fade",
                animationDuration: 150
              }}
            />
            <Stack.Screen
              name="receiving/index"
              options={{
                animation: "fade",
                animationDuration: 150
              }}
            />
            <Stack.Screen
              name="picking/index"
              options={{
                animation: "fade",
                animationDuration: 150
              }}
            />
            <Stack.Screen
              name="profile/index"
              options={{
                animation: "fade",
                animationDuration: 150
              }}
            />
            <Stack.Screen
              name="more/index"
              options={{
                animation: "fade",
                animationDuration: 150
              }}
            />
            <Stack.Screen
              name="more/item-info"
              options={{
                animation: "slide_from_right",
                animationDuration: 250
              }}
            />
            <Stack.Screen
              name="receiving/[id]"
              options={{
                animation: "slide_from_right",
                animationDuration: 250
              }}
            />
            <Stack.Screen
              name="picking/[id]"
              options={{
                animation: "slide_from_right",
                animationDuration: 250
              }}
            />
          </Stack>
          {showBottomNav ? <BottomNav /> : null}
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
