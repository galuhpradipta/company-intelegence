import { test, expect } from "@playwright/test";
import { installAuthState, registerUser } from "./helpers/api";

test("register a new account", async ({ page }) => {
  const ts = Date.now();
  await page.goto("/register");

  await page.getByLabel("Display name").fill("Test User");
  await page.getByLabel("Email").fill(`new-${ts}@playwright.test`);
  await page.getByLabel("Password").fill("testpass123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText(/Hey,/)).toBeVisible();
});

test("log in with existing account", async ({ page, request }) => {
  const { email, password } = await registerUser(request);

  await page.goto("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText(/Hey,/)).toBeVisible();
});

test("show error on invalid credentials", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("nobody@playwright.test");
  await page.getByLabel("Password").fill("wrongpassword");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
});

test("show error on duplicate registration", async ({ page, request }) => {
  const existing = await registerUser(request);

  await page.goto("/register");

  await page.getByLabel("Display name").fill("Another User");
  await page.getByLabel("Email").fill(existing.email);
  await page.getByLabel("Password").fill(existing.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("alert")).toHaveText("Email already registered");
});

test("disable register submit while request is in flight", async ({ page }) => {
  await page.route("**/api/auth/register", async (route) => {
    await page.waitForTimeout(1000);
    await route.continue();
  });

  await page.goto("/register");

  await page.getByLabel("Display name").fill("Slow User");
  await page.getByLabel("Email").fill(`slow-${Date.now()}@playwright.test`);
  await page.getByLabel("Password").fill("testpass123");

  const createAccount = page.locator('button[type="submit"]');
  const redirect = page.waitForURL("/");
  const click = createAccount.click({ noWaitAfter: true });

  await expect(createAccount).toBeDisabled();
  await expect(createAccount).toHaveText("Creating account…");

  await click;
  await redirect;
  await expect(page.getByText(/Hey,/)).toBeVisible();
});

test("disable login submit while request is in flight", async ({ page, request }) => {
  const { email, password } = await registerUser(request);

  await page.route("**/api/auth/login", async (route) => {
    await page.waitForTimeout(1000);
    await route.continue();
  });

  await page.goto("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  const signIn = page.locator('button[type="submit"]');
  const redirect = page.waitForURL("/");
  const click = signIn.click({ noWaitAfter: true });

  await expect(signIn).toBeDisabled();
  await expect(signIn).toHaveText("Signing in…");

  await click;
  await redirect;
  await expect(page.getByText(/Hey,/)).toBeVisible();
});

test("redirect unauthenticated users to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("redirect expired sessions to login with a toast", async ({ page }) => {
  await installAuthState(page, {
    user: {
      id: "stale-user",
      email: "stale@playwright.test",
      displayName: "Stale",
    },
    token: "invalid-token",
  });

  await page.goto("/");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Session expired. Please sign in again.")).toBeVisible();
});
