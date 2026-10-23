import { test, expect } from "@playwright/test";
import { tokyoDate, monday, addDays } from "../../src/lib/study";

test("共有設定のデモでリンク作成・停止を試せる", async ({ page }, testInfo) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/share")) calls.push(request.url());
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: "共有を試す", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "閲覧専用リンク",
    exact: true,
  });
  await expect(
    dialog.getByText("共有はオフです", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "閲覧専用リンクを作成", exact: true })
    .click();
  await expect(dialog.getByLabel("閲覧専用URL")).toHaveValue(/\/demo\/share$/);
  await expect(
    dialog.getByRole("button", { name: "リンクをコピー", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-share-dialog.png`,
    animations: "disabled",
  });
  await dialog
    .getByRole("button", { name: "新しいリンクに作り直す", exact: true })
    .click();
  await dialog.getByRole("button", { name: "共有を停止", exact: true }).click();
  await expect(
    dialog.getByText("共有はオフです", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("閲覧専用URL")).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("閲覧ページはログインなしでグラフを表示し、書き込み操作を提供しない", async ({
  page,
  request,
}, testInfo) => {
  const today = tokyoDate();
  const week = monday(today);
  const token = "f".repeat(43);
  let revoked = false;
  let header = "";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/shared-study", async (route) => {
    header = route.request().headers()["authorization"];
    await route.fulfill({
      status: revoked ? 404 : 200,
      json: revoked
        ? { error: "この共有リンクは無効か、共有が停止されています。" }
        : {
            days: [
              { date: week, subject: "数学", minutes: 90 },
              { date: addDays(week, 1), subject: "英語", minutes: 60 },
            ],
            goals: [{ weekStart: week, targetMinutes: 600 }],
            syncedAt: new Date().toISOString(),
            stale: false,
          },
    });
  });
  await page.goto(`/share/${token}`);
  await expect(page.getByText("閲覧専用", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "週の目標達成率" }),
  ).toBeVisible();
  await expect(page.locator(".shared-total").first()).toHaveText("2時間 30分");
  expect(header).toBe(`Bearer ${token}`);
  await expect(
    page.getByRole("button", { name: "記録する", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "目標を変更", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".record-table")).toHaveCount(0);
  await page.getByLabel("教科", { exact: true }).selectOption("数学");
  await expect(page.locator(".shared-total").first()).toHaveText("1時間 30分");
  await page.locator(".calendar-day.has-record").first().click();
  await expect(
    page.getByRole("region", { name: "選択日の学習時間" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const icon = await page
    .locator('link[rel="icon"][href*="icon.svg"]')
    .getAttribute("href");
  expect(icon).toBeTruthy();
  expect((await request.get(icon!)).status()).toBe(200);
  expect((await request.get("/favicon.ico")).status()).toBe(200);
  expect((await request.get("/apple-icon.png")).status()).toBe(200);
  for (const path of ["/api/share", "/api/records", "/api/goals"]) {
    expect(
      (
        await request.post(path, {
          headers: { Authorization: `Bearer ${token}` },
          data: {},
        })
      ).status(),
    ).toBe(401);
  }
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-shared-dashboard.png`,
    fullPage: true,
    animations: "disabled",
  });
  revoked = true;
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "共有ページを表示できません" }),
  ).toContainText("共有が停止");
  await expect(page.locator(".shared-total")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("存在しない共有リンクから実データを取得できない", async ({
  request,
  page,
}) => {
  const response = await request.get("/api/shared-study");
  expect(response.status()).toBe(404);
  expect((await request.delete("/api/share")).status()).toBe(401);
  const token = "z".repeat(43);
  expect(
    (
      await request.get("/api/shared-study", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(404);
  await page.goto(`/share/${token}`);
  await expect(
    page.getByRole("alert").filter({ hasText: "共有ページを表示できません" }),
  ).toContainText("共有リンクは無効");
  await expect(page.locator(".shared-total")).toHaveCount(0);
});
