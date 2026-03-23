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
  await expect(page.getByText("Cupertino, CA, US")).toBeVisible();
  await expect(page.getByText("people data labs")).toBeVisible();
  await expect(page.getByText("sec edgar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "News" })).toBeVisible();
});
