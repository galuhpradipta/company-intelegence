import { expect, test } from "@playwright/test";

test("single-company integration flow hits the real backend and isolated database", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("e.g. Apple Inc.").fill("Apple Inc.");
  await page.getByPlaceholder("e.g. apple.com").fill("apple.com");
  await page.getByPlaceholder("1 Apple Park Way").fill("1 Apple Park Way");
  await page.getByPlaceholder("New York").fill("Cupertino");
  await page.getByPlaceholder("NY").fill("CA");
  await page.getByPlaceholder("e.g. Technology").fill("Technology");

  await page.getByRole("button", { name: "Resolve Company" }).click();

  await expect(page).toHaveURL(/\/company\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Apple Inc." })).toBeVisible();
  await expect(page.getByText("apple.com")).toBeVisible();
  await expect(page.getByText("161,000")).toBeVisible();
  await expect(page.getByText("1 Apple Park Way, Cupertino, CA, US")).toBeVisible();
  await expect(page.getByText("Cupertino, CA, US")).toBeVisible();
  await expect(page.getByText("people data labs")).toBeVisible();
  await expect(page.getByText("sec edgar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "News" })).toBeVisible();
});

test("single-company suggested flow allows manual confirmation before opening the company detail view", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("e.g. Apple Inc.").fill("Beta Labs");
  await page.getByPlaceholder("1 Apple Park Way").fill("200 Mission Street");
  await page.getByPlaceholder("New York").fill("San Francisco");
  await page.getByPlaceholder("NY").fill("CA");
  await page.getByPlaceholder("e.g. Technology").fill("AI");

  await page.getByRole("button", { name: "Resolve Company" }).click();

  await expect(page.getByText("Suggested matches — confirm the correct company:")).toBeVisible();
  await expect(page.getByText("Beta Labs Inc.")).toBeVisible();

  await page.getByRole("button", { name: "Confirm Beta Labs Inc." }).click();

  await expect(page).toHaveURL(/\/company\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Beta Labs Inc." })).toBeVisible();
  await expect(page.getByText("200 Mission Street, San Francisco, CA, US")).toBeVisible();
  await expect(page.getByText("No news articles found.")).toBeVisible();
  await expect(page.getByText("News is fetched automatically for confident matches.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fetch news manually →" })).toBeVisible();
});

test("single-company not-found flow keeps the user on the input view with a retry message", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("e.g. Apple Inc.").fill("Gamma Systems");
  await page.getByPlaceholder("1 Apple Park Way").fill("40 Lake Shore");
  await page.getByPlaceholder("New York").fill("Chicago");
  await page.getByPlaceholder("NY").fill("IL");
  await page.getByPlaceholder("e.g. Technology").fill("Robotics");

  await page.getByRole("button", { name: "Resolve Company" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("alert")).toContainText("No matches found. Try providing more context.");
  await expect(page.getByRole("heading", { name: "Resolve Companies" })).toBeVisible();
});
