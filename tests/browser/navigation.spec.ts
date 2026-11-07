import { test, expect } from "@playwright/test";

test("節へ移動して選択位置を示し、記録を表として読める", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo");
  await expect(page.locator(".record-table tbody tr").first()).toBeVisible();
  const nav = page.getByRole("navigation", { name: "メインナビゲーション" });
  for (const [label, id] of [
    ["学習記録", "records"],
    ["教材", "materials"],
    ["カレンダー", "calendar"],
    ["学習の推移", "weekly"],
    ["概要", "overview"],
  ]) {
    const link = nav.getByRole("link", { name: label, exact: true });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "location");
    const top = await page
      .locator(`#${id}`)
      .evaluate((node) => node.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(700);
  }
  await expect(page.getByRole("table", { name: "学習記録の一覧" })).toHaveCount(
    1,
  );
  await nav.getByRole("link", { name: "学習記録", exact: true }).click();
  await expect(page.locator(".record-title").first()).toBeInViewport();
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
