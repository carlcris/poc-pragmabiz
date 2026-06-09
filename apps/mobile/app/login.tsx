import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { spacing, borderRadius, shadows, sizes } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const DEV_EMAIL = "demo@pragmatica.app";
const DEV_PASSWORD = "demo1234";

export default function LoginScreen() {
  const [email, setEmail] = useState(__DEV__ ? DEV_EMAIL : "");
  const [password, setPassword] = useState(__DEV__ ? DEV_PASSWORD : "");
  const [submitting, setSubmitting] = useState(false);
  const { login, error } = useAuthStore();

  const submit = async () => {
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.shell}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="cube-outline" size={48} color={colors.primary} />
            </View>
            <Text style={styles.title}>Warehouse Operations</Text>
            <Text style={styles.subtitle}>Sign in to continue to your account</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={colors.muted} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={styles.input}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={submitting || !email.trim() || !password}
              onPress={submit}
              style={[styles.button, submitting || !email.trim() || !password ? styles.disabled : null]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  shell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl
  },
  container: {
    width: "100%",
    maxWidth: 440,
    gap: spacing["3xl"]
  },
  header: {
    alignItems: "center",
    gap: spacing.md
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm
  },
  title: {
    ...typography.heading1,
    color: colors.text,
    textAlign: "center"
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center"
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.md
  },
  inputGroup: {
    gap: spacing.sm
  },
  label: {
    ...typography.label,
    color: colors.text
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: sizes.input.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surface
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: colors.danger
  },
  error: {
    ...typography.bodySmall,
    color: colors.danger,
    flex: 1
  },
  button: {
    flexDirection: "row",
    minHeight: sizes.button.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    ...shadows.md
  },
  disabled: {
    opacity: 0.5
  },
  buttonText: {
    ...typography.button,
    color: "#FFFFFF"
  }
});
