import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  valid: vi.fn(),
  sync: vi.fn(),
  change: vi.fn(),
  settings: vi.fn(),
  summary: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ authorized: mocks.auth }));
vi.mock("@/lib/widget", () => ({
  validWidgetToken: mocks.valid,
  widgetSummary: mocks.summary,
  changeWidget: mocks.change,
  widgetSettings: mocks.settings,
}));
vi.mock("@/lib/sync", () => ({ synchronize: mocks.sync }));
import { GET as summary } from "@/app/api/widget/summary/route";
import { GET, POST, DELETE } from "@/app/api/widget/settings/route";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXTAUTH_URL", "https://app.test");
});
afterEach(() => vi.unstubAllEnvs());
it("requires login and same-origin for key management", async () => {
  mocks.auth.mockResolvedValue(false);
  expect((await GET()).status).toBe(401);
  for (const method of [POST, DELETE])
    expect((await method(new Request("https://app.test"))).status).toBe(401);
  mocks.auth.mockResolvedValue(true);
  expect(
    (
      await POST(
        new Request("https://app.test", {
          headers: { origin: "https://evil.test" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.change).not.toHaveBeenCalled();
});
it("does not call Notion for invalid keys", async () => {
  mocks.valid.mockResolvedValue(false);
  expect((await summary(new Request("https://app.test"))).status).toBe(401);
  expect(mocks.sync).not.toHaveBeenCalled();
});
it("honors revocation during synchronization", async () => {
  mocks.valid.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(
    (
      await summary(
        new Request("https://app.test", {
          headers: { authorization: "Bearer ws_test" },
        }),
      )
    ).status,
  ).toBe(401);
  expect(mocks.summary).not.toHaveBeenCalled();
});
it("returns only summary and never caches it", async () => {
  mocks.valid.mockResolvedValue(true);
  mocks.summary.mockReturnValue({ minutes: 30 });
  const response = await summary(new Request("https://app.test"));
  expect(await response.json()).toEqual({ minutes: 30 });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
