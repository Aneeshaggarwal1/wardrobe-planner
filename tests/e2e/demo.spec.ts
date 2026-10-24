import { expect, test } from "@playwright/test";

/**
 * The core daily loop in demo mode:
 * Landing → Try the demo → Wear this → the shirt goes to the laundry →
 * Laundry done → All ironed → the outfit is back on Today.
 * Also asserts demo mode never talks to Supabase or the Claude API.
 */
test("demo daily loop: wear, wash, iron, wear again", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (/supabase\.co|anthropic\.com/.test(url)) external.push(url);
  });

  await page.goto("/");
  await page.getByTestId("try-demo").click();
  await expect(page).toHaveURL(/\/today$/);

  const first = page.getByTestId("today-outfit").first();
  await expect(first).toBeVisible();
  const outfitId = await first.getAttribute("data-outfit-id");
  expect(outfitId).toBeTruthy();

  await first.getByRole("button", { name: "Wear this" }).click();
  await expect(page.getByRole("status")).toContainText("Logged");
  await expect(page.locator(`[data-outfit-id="${outfitId}"]`)).toHaveCount(0);

  // Shirts have a one-wear limit, so the top is now in the laundry.
  await page.getByRole("link", { name: "Laundry", exact: true }).click();
  await expect(page.getByTestId("group-in_laundry")).not.toContainText("Nothing here");
  await page.getByTestId("laundry-done").click();
  await expect(page.getByTestId("laundry-done")).toBeDisabled();
  await page.getByTestId("all-ironed").click();
  await expect(page.getByTestId("all-ironed")).toBeDisabled();

  // Everything is ready again; the worn outfit returns to rotation.
  await page.getByRole("link", { name: "Outfits", exact: true }).click();
  await expect(page.locator(`[data-outfit-id="${outfitId}"]`)).toBeVisible();

  expect(external).toEqual([]);
});

test("reset demo restores the seed", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("try-demo").click();
  await page.getByTestId("today-outfit").first().getByRole("button", { name: "Wear this" }).click();
  await expect(page.getByText("Wearing today")).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByText("Demo reset to the sample wardrobe")).toBeVisible();
  await page.getByTestId("try-demo").click();
  await expect(page.getByText("Wearing today")).toHaveCount(0);
});

test("curate: generate, approve and the bank grows", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("try-demo").click();
  await page.goto("/curate");
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("candidate")).toBeVisible();
  const before = await page.getByText(/in bank/).textContent();
  await page.getByTestId("approve").click();
  await expect(page.getByText(/in bank/)).not.toHaveText(before ?? "");
});
