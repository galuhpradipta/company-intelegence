import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

test("csv integration flow uses real backend batch processing with isolated database state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "CSV Upload" }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: "companies.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "company_name,domain,address,city,state,country,industry",
        "Acme Corp,acme.com,,Seattle,WA,US,Software",
        "Beta Labs,,200 Mission Street,San Francisco,CA,US,AI",
        "Gamma Systems,,40 Lake Shore,Chicago,IL,US,Robotics",
        ",,Missing Name,Chicago,IL,US,Robotics",
      ].join("\n"),
    ),
  });

  await expect(page.getByText("Preview first 3 valid rows before processing:")).toBeVisible();
  await expect(page.getByText("Row 5: Missing required field: company_name")).toBeVisible();

  await page.getByRole("button", { name: "Start Processing" }).click();

  await expect(page).toHaveURL(/\/results\/[0-9a-f-]+$/);
  await expect(page.getByText("3 / 3 processed")).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText("Confident", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Suggested", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Not Found", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acme Corp" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Beta Labs Inc." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gamma Systems" })).toBeVisible();
  await expect(page.getByText("Top 3 candidates")).toBeVisible();
  await expect(page.getByRole("button", { name: "Selected" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Retry with different inputs" })).toBeVisible();
});
