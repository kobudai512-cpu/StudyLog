import { test, expect } from "@playwright/test";
test("Notion目標の表示・週移動・カレンダーから1日と時間帯を表示", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo");
  await expect(page.locator(".record-table tbody tr").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "記録する", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".reflection-flower")).toHaveCount(0);
  await expect(page.getByText("デモの目標", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "週の目標達成率" }),
  ).toBeVisible();
  const goalText = await page.locator(".goal-result").innerText();
  await page.getByRole("button", { name: "前の週", exact: true }).click();
  await expect(
    page.getByText("表示週の学習時間", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".goal-result")).not.toHaveText(goalText, {
    useInnerText: true,
  });
  await page.getByRole("button", { name: "次の週", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "次の週", exact: true }),
  ).toBeDisabled();
  const month = await page.locator(".calendar-navigation strong").innerText();
  await page.getByRole("button", { name: "前の月", exact: true }).click();
  await expect(page.locator(".calendar-navigation strong")).not.toHaveText(
    month,
  );
  await page.getByRole("button", { name: "今月へ", exact: true }).click();
  await expect(page.locator(".calendar-navigation strong")).toHaveText(month);
  await page.locator(".calendar-day.has-record").first().click();
  await expect(
    page.getByRole("heading", { name: "時間帯別の学習時間", exact: true }),
  ).toBeVisible();
  await page.getByText("時間帯別の数値を表で見る", { exact: true }).click();
  await expect(
    page
      .getByRole("table", { name: "時間帯別の学習時間（分）", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(24);
  await expect(page.locator(".hourly-note")).toContainText("1日合計");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("progressbar", { name: "週の目標達成率" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
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
  await page
    .getByRole("region", { name: "表示条件" })
    .getByLabel("教科", { exact: true })
    .selectOption("数学");
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
  await page
    .getByRole("region", { name: "表示条件" })
    .getByLabel("教科", { exact: true })
    .selectOption("all");
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
    animations: "disabled",
  });
});
test("未認証アクセスは実データを返さない", async ({ request, page }) => {
  expect((await request.get("/api/study")).status()).toBe(401);
  expect((await request.get("/api/records")).status()).toBe(401);
  expect((await request.post("/api/records", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/goals", { data: {} })).status()).toBe(401);
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

test("記録ポップアップ・推定プレビュー・デモ保存・閉じる操作", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo");
  await page.getByRole("button", { name: "記録する", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "勉強を記録する" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("勉強内容", { exact: true })
    .fill("GUIからの架空の記録");
  await dialog.getByLabel("教科", { exact: true }).selectOption("物理");
  await dialog
    .getByLabel("終了日時（日本時間）", { exact: true })
    .fill("2026-10-22T02:31");
  await dialog.getByLabel("実績時間（時間）", { exact: true }).fill("1");
  await dialog.getByLabel("実績時間（分）", { exact: true }).fill("31");
  await expect(dialog.locator(".record-preview")).toContainText("01:00");
  await expect(dialog.locator(".record-preview")).toContainText("02:31");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "記録する", exact: true }).click();
  await expect(dialog.getByLabel("勉強内容", { exact: true })).toHaveValue(
    "GUIからの架空の記録",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-record-dialog.png`,
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "デモに追加", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "デモに追加しました" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.locator(".record-table")).toContainText(
    "GUIからの架空の記録",
  );
  expect(errors).toEqual([]);
});

test("目標を時間と分で設定し、週ごとに保持する", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "目標を変更", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "週の目標を設定",
    exact: true,
  });
  await dialog.getByLabel("目標時間（時間）", { exact: true }).fill("12");
  await dialog.getByLabel("目標時間（分）", { exact: true }).fill("30");
  await dialog.getByRole("button", { name: "デモの目標を保存" }).click();
  await expect(dialog.getByText("デモの目標を更新しました")).toBeVisible();
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.locator(".goal-result")).toContainText("12時間 30分");
  await page.getByRole("button", { name: "前の週", exact: true }).click();
  await expect(page.locator(".goal-result")).not.toContainText("12時間 30分");
  await page.getByRole("button", { name: "次の週", exact: true }).click();
  await expect(page.locator(".goal-result")).toContainText("12時間 30分");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
