import { expect, test } from "@playwright/test";

/**
 * Captures every screen in demo mode at phone width (375px) into docs/screens/.
 * Run with: npx playwright test screens
 */
const SHOTS = [
  { path: "/today", file: "1-today" },
  { path: "/outfits", file: "2-outfits" },
  { path: "/wardrobe", file: "3-wardrobe" },
  { path: "/laundry", file: "4-laundry" },
  { path: "/review", file: "6-review" },
  { path: "/upload", file: "7-upload" },
];

test("capture all screens", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "docs/screens/0-landing.png", fullPage: true });
  await page.getByTestId("try-demo").click();
  await expect(page.getByTestId("today-outfit").first()).toBeVisible();

  for (const shot of SHOTS) {
    await page.goto(shot.path);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `docs/screens/${shot.file}.png`, fullPage: true });
  }

  await page.goto("/curate");
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("candidate")).toBeVisible();
  await page.screenshot({ path: "docs/screens/5-curate.png", fullPage: true });

  // Item sheet and empty state.
  await page.goto("/wardrobe");
  await page.getByRole("button", { name: /light blue formal shirt/i }).first().click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: "docs/screens/8-item-sheet.png" });

  await page.goto("/laundry");
  await page.evaluate(() => {
    const key = "wp-demo-snapshot-v1";
    const s = JSON.parse(localStorage.getItem(key)!);
    for (const i of s.items) if (i.category === "top") i.state = "needs_ironing";
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.goto("/today");
  await expect(page.getByTestId("nothing-ready")).toBeVisible();
  await page.screenshot({ path: "docs/screens/9-nothing-ready.png", fullPage: true });
});
