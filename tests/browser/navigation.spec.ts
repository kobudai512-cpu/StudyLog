import { test, expect } from "@playwright/test";

test("ジャンプナビを省き、学習記録を一覧表示する", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Study Log" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "メインナビゲーション" }),
  ).toHaveCount(0);
  await expect(page.locator(".record-table tbody tr").first()).toBeVisible();
});

test("狭い画面でも主要な操作が画面内に収まる", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/demo");
  await expect(page.locator(".record-table tbody tr").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "記録する", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "勉強を記録する" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "記録する", exact: true }),
  ).toBeFocused();
});
