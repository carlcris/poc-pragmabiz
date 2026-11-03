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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { spacing, borderRadius, sizes } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { primaryGlow } from "@/theme/elevation";
import { createTranslator } from "use-intl/core";
import { translations } from "../../../src/lib/i18n/translations";
import { getLoginErrorMessage } from "../../../src/lib/auth/login-errors";

// The native app currently uses English; reuse the web source of truth for sign-in guidance.
const tLoginErrors = createTranslator({ locale: "en", messages: translations.en.loginErrors });

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, error, clearError } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const submittingRef = useRef(false);
  const canSubmit = !submitting && Boolean(email.trim()) && Boolean(password);

  const scrollFormAboveKeyboard = () => {
    if (Keyboard.isVisible()) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  };

  // iOS shrinks the scroll viewport before keyboardDidShow; Android shrinks it after,
  // so the viewport layout change must also bring the form above the keyboard.
  useEffect(() => {
    clearError();
    const keyboardSubscription = Keyboard.addListener("keyboardDidShow", scrollFormAboveKeyboard);

    return () => keyboardSubscription.remove();
  }, [clearError]);

  const submit = async () => {
    if (!canSubmit || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch {
      // The auth store owns the displayed error state.
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="padding" style={styles.shell}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          onLayout={scrollFormAboveKeyboard}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.band} pointerEvents="none">
            <View style={[styles.bandCircle, styles.bandCircleLarge]} />
            <View style={[styles.bandCircle, styles.bandCircleSmall]} />
          </View>
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
                    onChangeText={(value) => {
                      setEmail(value);
                      clearError();
                    }}
                    editable={!submitting}
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
                    onChangeText={(value) => {
                      setPassword(value);
                      clearError();
                    }}
                    editable={!submitting}
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
                <View
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.errorContainer}
                >
                  <Ionicons name="alert-circle" size={20} color={colors.danger} />
                  <Text style={styles.error}>{getLoginErrorMessage(error, tLoginErrors)}</Text>
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
    backgroundColor: colors.background,
  },
  shell: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: spacing.base,
    paddingTop: spacing["5xl"],
  },
  container: {
    width: "100%",
    maxWidth: 440,
    gap: spacing.xl,
  },
  band: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 330,
    overflow: "hidden",
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    backgroundColor: colors.violetSoft
  },
  bandCircle: {
    position: "absolute",
    backgroundColor: colors.violet,
    opacity: 0.12
  },
  bandCircleLarge: {
    right: -60,
    top: -70,
    width: 240,
    height: 240,
    borderRadius: 120
  },
  bandCircleSmall: {
    left: -50,
    top: 150,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.08
  },
  header: {
    alignItems: "center",
    gap: spacing.md,
  },
  logoContainer: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
    padding: 14,
    borderRadius: 28,
    backgroundColor: colors.surface,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  title: {
    ...typography.heading1,
    color: colors.text,
    textAlign: "center",
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.base,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 8,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  passwordToggle: {
    width: sizes.button.base,
    height: sizes.button.base,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
  },
  error: {
    ...typography.bodySmall,
    color: colors.danger,
    flex: 1,
  },
  button: {
    flexDirection: "row",
    minHeight: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    ...primaryGlow,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.button,
    color: colors.surface,
  },
});
