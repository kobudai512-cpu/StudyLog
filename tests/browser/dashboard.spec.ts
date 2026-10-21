import { test, expect } from "@playwright/test";
test("デモ・フィルター・状態・更新とレスポンシブ表示", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo");
  await expect(
    page.getByText(
      "架空の学習記録を表示しています。Notionの実データではありません。",
    ),
  ).toBeVisible();
  await expect(page.locator(".record-table tbody tr").first()).toBeVisible();
  await page.getByRole("button", { name: "今月", exact: true }).click();
  await page.getByLabel("教科", { exact: true }).selectOption("数学");
  await expect(page.locator(".record-table .subject-badge").first()).toHaveText(
    "数学",
  );
  await expect(
    page.locator(".record-table .subject-badge").filter({ hasNotText: "数学" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "期間を指定", exact: true }).click();
  await page.getByLabel("開始日", { exact: true }).fill("2026-10-22");
  await page.getByLabel("終了日", { exact: true }).fill("2026-10-21");
  await expect(
    page.getByRole("alert").filter({ hasText: "開始日と終了日" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "今週", exact: true }).click();
  await page.getByLabel("教科", { exact: true }).selectOption("all");
  await page.getByRole("button", { name: "更新", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "更新", exact: true }),
  ).toBeEnabled();
  await page.locator(".demo-tools summary").click();
  await page.getByLabel("デモの表示状態").selectOption("error");
  await expect(
    page.getByRole("alert").filter({ hasText: "接続に失敗" }),
  ).toBeVisible();
  await page.getByLabel("デモの表示状態").selectOption("issues");
  await expect(page.getByRole("status")).toContainText("2件");
  await page.getByLabel("デモの表示状態").selectOption("empty");
  await expect(page.getByText("この期間の記録はまだありません")).toBeVisible();
  await page.getByLabel("デモの表示状態").selectOption("normal");
  await expect(page.locator(".record-table tbody tr").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-dashboard.png`,
    fullPage: true,
  });
});
test("未認証アクセスは実データを返さない", async ({ request, page }) => {
  expect((await request.get("/api/study")).status()).toBe(401);
  expect(
    (
      await request.post("/api/study", {
        headers: { Origin: "http://127.0.0.1:3000" },
      })
    ).status(),
  ).toBe(401);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /デモダッシュボードを見る/ }),
  ).toBeVisible();
  await expect(page.locator(".record-table")).toHaveCount(0);
});
