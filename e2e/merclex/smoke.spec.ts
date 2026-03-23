import { expect, test } from "@playwright/test";

test("Merclex input view renders the core trial entry points", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Resolve Companies" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Single Company" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CSV Upload" })).toBeVisible();
  await expect(page.getByPlaceholder("e.g. Apple Inc.")).toBeVisible();

  await page.getByRole("button", { name: "CSV Upload" }).click();

  await expect(page.getByText(/Drop a CSV file here/i)).toBeVisible();
  await expect(page.getByText("Download CSV template")).toBeVisible();
});
