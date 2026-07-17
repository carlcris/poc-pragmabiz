import type { ConfigContext, ExpoConfig } from "expo/config";

const localHttpBuildProperties: NonNullable<ExpoConfig["plugins"]>[number] = [
  "expo-build-properties",
  {
    android: {
      usesCleartextTraffic: true
    }
  }
];

export default ({ config }: ConfigContext) => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const usesLocalHttp = apiBaseUrl?.startsWith("http://") ?? false;

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ...(usesLocalHttp ? [localHttpBuildProperties] : [])
    ]
  };
};
