import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, error } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const canSubmit = !submitting && Boolean(email.trim()) && Boolean(password);

  useEffect(() => {
    const keyboardSubscription = Keyboard.addListener("keyboardDidShow", () => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    return () => keyboardSubscription.remove();
  }, []);

  const submit = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch {
      // The auth store owns the displayed error state.
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
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../assets/achlers_logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Achlers Integrated</Text>
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
                    autoComplete="email"
                    autoCorrect={false}
                    enablesReturnKeyAutomatically
                    keyboardType="email-address"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    returnKeyType="next"
                    submitBehavior="submit"
                    textContentType="emailAddress"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text nativeID="password-label" style={styles.label}>
                  Password
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
                  <TextInput
                    ref={passwordInputRef}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.muted}
                    autoComplete="current-password"
                    enablesReturnKeyAutomatically
                    onSubmitEditing={() => void submit()}
                    returnKeyType="go"
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    style={styles.input}
                  />
                  <Pressable
                    accessibilityLabelledBy="password-label"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showPassword }}
                    hitSlop={spacing.sm}
                    onPress={() => setShowPassword((visible) => !visible)}
                    style={styles.passwordToggle}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={sizes.icon.sm}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color={colors.danger} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                disabled={!canSubmit}
                onPress={submit}
                style={[styles.button, !canSubmit ? styles.disabled : null]}
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
        </ScrollView>
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
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
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
  logoContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm
  },
  logo: {
    width: "100%",
    height: "100%"
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
  passwordToggle: {
    width: sizes.button.base,
    height: sizes.button.base,
    alignItems: "center",
    justifyContent: "center"
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
