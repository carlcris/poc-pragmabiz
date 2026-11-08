import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useAuthStore } from "@/stores/authStore";
import { LogoutBackdrop } from "./LogoutBackdrop";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `userMenu.${key}:${JSON.stringify(values)}` : `userMenu.${key}`,
}));
vi.mock("@/lib/supabase/client", () => ({ supabase: { auth: {} } }));

afterEach(() => {
  useAuthStore.setState({ user: null });
});

it("renders a full-screen modal backdrop with an accessible translated status", () => {
  const html = renderToStaticMarkup(<LogoutBackdrop />);
  expect(html).toContain("<dialog");
  expect(html).toContain("backdrop:bg-black/70");
  expect(html).toContain('role="status"');
  expect(html).toContain("userMenu.signingOut");
  expect(html).toContain('aria-hidden="true"');
});

it("bids the signed-in user farewell by first name with their initials", () => {
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "carlito@example.com",
      name: "Carlito Cruz",
      role: "admin",
      companyId: "company-1",
    },
  });
  const html = renderToStaticMarkup(<LogoutBackdrop />);
  expect(html).toContain("CC");
  expect(html).toContain("userMenu.farewellNamed:{&quot;name&quot;:&quot;Carlito&quot;}");
});

it("falls back to a generic farewell when no user is loaded", () => {
  const html = renderToStaticMarkup(<LogoutBackdrop />);
  expect(html).toContain("userMenu.farewell<");
  expect(html).not.toContain("farewellNamed");
});
