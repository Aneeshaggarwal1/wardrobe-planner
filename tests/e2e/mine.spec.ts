import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/**
 * Your own wardrobe, end to end, with the AI endpoints mocked so no key or
 * passcode is needed and no money is spent:
 * set up → passcode → add 2 photos → tags appear → review → pair → keep →
 * back up → wipe → restore.
 */

const SHIRT_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABQCAIAAAAm3eQSAAAAeklEQVR4Xu3RAQkAIQAEQbV/oc9hDUPIp1iEmQR37Pz2GS9bL4//OVBToKZATYGaAjUFagrUFKgpUFOgpkBNgZoCNQVqCtQUqClQU6CmQE2BmgI1BWoK1BSoKVBToKZATYGaAjUFagrUFKgpUFOgpkBNgZoCNQVqCtQu/3YDGAengBsAAAAASUVORK5CYII=";
const TROUSERS_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABQCAIAAAAm3eQSAAAAeklEQVR4Xu3RAQkAIQAEQbXIRzCK/dvIp1iEmQR37Pz2GS9bL4//OVBToKZATYGaAjUFagrUFKgpUFOgpkBNgZoCNQVqCtQUqClQU6CmQE2BmgI1BWoK1BSoKVBToKZATYGaAjUFagrUFKgpUFOgpkBNgZoCNQVqCtQuFD4BPaIcEvUAAAAASUVORK5CYII=";

const TAGS = [
  {
    category: "top",
    subcategory: "formal shirt",
    primary_color: "light blue",
    secondary_color: null,
    pattern: "solid",
    formality: 4,
    fit: "slim",
    confidence: 0.95,
  },
  {
    category: "bottom",
    subcategory: "formal trousers",
    primary_color: "navy",
    secondary_color: null,
    pattern: "solid",
    formality: 4,
    fit: "regular",
    confidence: 0.55,
  },
];

async function mockAi(page: Page) {
  const seen = { tag: 0, rerank: 0, passcodes: new Set<string>(), bodies: [] as string[] };
  await page.route("**/api/tag", async (route) => {
    const req = route.request();
    seen.passcodes.add(req.headers()["x-app-passcode"] ?? "");
    seen.bodies.push(req.postData() ?? "");
    const tags = TAGS[seen.tag++ % TAGS.length];
    await route.fulfill({ json: { tags } });
  });
  await page.route("**/api/rerank", async (route) => {
    seen.rerank++;
    await route.fulfill({ json: { ranking: [{ i: 0, reason: "Pale blue over navy: sharp and calm" }] } });
  });
  return seen;
}

test("your wardrobe: add photos, pair, back up and restore", async ({ page }) => {
  const seen = await mockAi(page);
  const external: string[] = [];
  page.on("request", (r) => {
    if (/anthropic\.com|supabase\.co/.test(r.url())) external.push(r.url());
  });

  await page.goto("/");
  await page.getByTestId("start-mine").click();
  await expect(page.getByText("Let's set up your wardrobe")).toBeVisible();
  await page.getByRole("link", { name: "Add your clothes" }).click();

  // Passcode once, then photos.
  await page.getByTestId("passcode-input").fill("test-passcode");
  await page.getByTestId("passcode-save").click();
  await page.getByTestId("photo-input").setInputFiles([
    { name: "shirt.png", mimeType: "image/png", buffer: Buffer.from(SHIRT_PNG, "base64") },
    { name: "trousers.png", mimeType: "image/png", buffer: Buffer.from(TROUSERS_PNG, "base64") },
  ]);
  await expect(page.getByTestId("tagged-name")).toHaveCount(2);
  await expect(page.getByText("2 items added")).toBeVisible();
  await expect(page.getByText("Not sure about this one: check its tags")).toHaveCount(1);
  expect([...seen.passcodes]).toEqual(["test-passcode"]);
  // Photos go to the tagger as resized JPEG base64.
  for (const body of seen.bodies) expect(JSON.parse(body).image).toMatch(/^\/9j\//);

  // Review → pair (AI re-rank mocked) → keep.
  await page.getByTestId("go-review").click();
  await expect(page.getByText("Check me")).toHaveCount(1);
  await page.getByRole("button", { name: "Confirm wardrobe and pair outfits" }).click();
  await expect(page.getByTestId("candidate")).toContainText("Pale blue over navy: sharp and calm");
  expect(seen.rerank).toBe(1);
  await page.getByTestId("approve").click();

  // Today now has one wearable outfit.
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("today-outfit")).toHaveCount(1);

  // Survives a reload (IndexedDB).
  await page.reload();
  await expect(page.getByTestId("today-outfit")).toHaveCount(1);

  // Back up.
  await page.getByRole("link", { name: "Wardrobe", exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("backup").click()]);
  expect(download.suggestedFilename()).toMatch(/^wardrobe-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const backup = JSON.parse(await readFile(file, "utf8"));
  expect(backup.app).toBe("wardrobe-planner");
  expect(backup.snapshot.items).toHaveLength(2);
  expect(backup.snapshot.items[0].thumb_url).toMatch(/^data:image\/jpeg;base64,/);

  // Wipe the wardrobe, then restore it from the file.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("wardrobe-planner");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
  await page.reload();
  await expect(page.getByText("No clothes yet")).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("restore-input").setInputFiles(file);
  await expect(page.getByText("Wardrobe restored from backup")).toBeVisible();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("today-outfit")).toHaveCount(1);

  expect(external).toEqual([]);
});

test("a wrong passcode asks again", async ({ page }) => {
  await page.route("**/api/tag", (route) => route.fulfill({ status: 401, json: { error: "Wrong passcode" } }));
  await page.goto("/");
  await page.getByTestId("start-mine").click();
  await page.goto("/upload");
  await page.getByTestId("passcode-input").fill("nope");
  await page.getByTestId("passcode-save").click();
  await page.getByTestId("photo-input").setInputFiles([
    { name: "shirt.png", mimeType: "image/png", buffer: Buffer.from(SHIRT_PNG, "base64") },
  ]);
  await expect(page.getByText("That passcode didn't work")).toBeVisible();
  await expect(page.getByTestId("passcode-input")).toBeVisible();
});
