import { http, HttpResponse } from "msw";

const mockUser = {
  id: "user-1",
  email: "admin@erp.com",
  name: "Admin User",
  role: "admin",
  companyId: "company-1",
};

export const authHandlers = [
  // Login
  http.post("/api/auth/login", async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    if (body.email === "admin@erp.com" && body.password === "admin123") {
      return HttpResponse.json({
        user: mockUser,
        token: "mock-jwt-token",
      });
    }

    return HttpResponse.json(
      { message: "Invalid credentials" },
      { status: 401 }
    );
  }),

  // Get current user
  http.get("/api/auth/me", ({ request }) => {
    const authHeader = request.headers.get("Authorization");

    if (authHeader === "Bearer mock-jwt-token") {
      return HttpResponse.json({ user: mockUser });
    }

    return HttpResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }),

  // Logout
  http.post("/api/auth/logout", () => {
    return HttpResponse.json({ message: "Logged out successfully" });
  }),
];
