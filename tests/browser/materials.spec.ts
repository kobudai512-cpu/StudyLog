import { test, expect } from "@playwright/test";
test("教材でグラフ・一覧を絞り込み、教材の順位と記録を並べ替える", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo");
  await expect(page.locator(".material-table tbody tr").first()).toBeVisible();
  const goal = await page.locator(".goal-result").innerText();
  await page
    .getByLabel("教材", { exact: true })
    .selectOption("book:英語の単語帳（デモ）");
  await expect(page.locator(".record-table tbody tr").first()).toBeVisible();
  for (const cell of await page
    .locator(".record-table .record-material")
    .allTextContents())
    expect(cell).toBe("英語の単語帳（デモ）");
  await expect(page.locator(".goal-result")).toHaveText(goal, {
    useInnerText: true,
  });
  await page.getByLabel("教材ランキングの並び順").selectOption("count");
  const counts = await page
    .locator(".material-table tbody tr td:nth-child(4)")
    .allTextContents();
  const numbers = counts.map(Number.parseFloat);
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
  await page.getByLabel("記録の並び順").selectOption("time-desc");
  const times = (
    await page.locator(".record-table .record-time").allTextContents()
  ).map((v) => {
    const m = v.match(/(\d+)時間\s*([\d.]+)分/)!;
    return Number(m[1]) * 60 + Number(m[2]);
  });
  expect(times).toEqual([...times].sort((a, b) => b - a));
  await page
    .getByRole("button", { name: "教材未設定で絞り込む", exact: true })
    .click();
  for (const cell of await page
    .locator(".record-table .record-material")
    .allTextContents())
    expect(cell).toBe("教材未設定");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".material-panel").screenshot({
    path: `test-results/${info.project.name}-material-ranking.png`,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("新しい教材名を記録に入力し、保存後の教材フィルターで選べる", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "記録する", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "勉強を記録する" });
  await dialog.getByLabel("勉強内容", { exact: true }).fill("教材つきデモ記録");
  await dialog.getByLabel("教科", { exact: true }).selectOption("数学");
  await dialog.getByLabel("実績時間（時間）", { exact: true }).fill("1");
  await dialog.getByLabel("実績時間（分）", { exact: true }).fill("10");
  await dialog
    .getByLabel("教材（任意）", { exact: true })
    .fill("新しい教材（デモ）");
  await dialog.getByRole("button", { name: "デモに追加", exact: true }).click();
  await expect(
    dialog.getByText("デモに追加しました", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await page
    .getByLabel("教材", { exact: true })
    .selectOption("book:新しい教材（デモ）");
  await expect(page.locator(".record-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".record-table")).toContainText("教材つきデモ記録");
  await expect(page.locator(".record-table")).toContainText("1時間 10分");
});
