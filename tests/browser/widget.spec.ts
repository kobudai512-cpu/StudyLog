import { test, expect } from "@playwright/test";
test("スマホ連携の案内・認証保護・APK配布", async ({ page, request }) => {
  await page.goto("/widget");
  await expect(
    page.getByRole("heading", { name: "今週を、ホーム画面に。" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ログインして連携する" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await request.get("/api/widget/settings")).status()).toBe(401);
  expect((await request.get("/api/widget/summary")).status()).toBe(401);
  const apk = await request.get("/downloads/winkle-study.apk");
  expect(apk.status()).toBe(200);
  expect((await apk.body()).subarray(0, 2).toString()).toBe("PK");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator(".widget-preview")).toHaveCSS(
    "background-color",
    "rgb(17, 17, 17)",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".widget-preview")).toHaveCSS(
    "background-color",
    "rgb(242, 242, 242)",
  );
});
