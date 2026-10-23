import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ authorized: vi.fn() }));
vi.mock("@/lib/sharing", () => ({
  shareSettings: vi.fn(),
  changeSharing: vi.fn(),
  validShareToken: vi.fn(),
}));
vi.mock("@/lib/sync", () => ({ synchronize: vi.fn() }));
import { authorized } from "@/lib/auth";
import { shareSettings, changeSharing, validShareToken } from "@/lib/sharing";
import { synchronize } from "@/lib/sync";
import { GET, POST, DELETE } from "@/app/api/share/route";
import { GET as sharedGET } from "@/app/api/shared-study/route";
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
const request = (origin = "https://app.test") =>
  new Request("https://app.test/api/share", {
    method: "POST",
    headers: { Origin: origin },
  });
it("本人以外は共有設定の閲覧・作成・停止ができない", async () => {
  vi.mocked(authorized).mockResolvedValue(false);
  expect((await GET()).status).toBe(401);
  expect((await POST(request())).status).toBe(401);
  expect((await DELETE(request())).status).toBe(401);
  expect(shareSettings).not.toHaveBeenCalled();
  expect(changeSharing).not.toHaveBeenCalled();
});
it("共有リンク作成・停止は本人かつ正規Originだけ", async () => {
  vi.stubEnv("NEXTAUTH_URL", "https://app.test");
  vi.mocked(authorized).mockResolvedValue(true);
  expect((await POST(request("https://evil.test"))).status).toBe(403);
  expect((await DELETE(request("https://evil.test"))).status).toBe(403);
  expect(changeSharing).not.toHaveBeenCalled();
  vi.mocked(changeSharing).mockResolvedValue({
    enabled: true,
    path: "/share/fixture",
  });
  expect((await POST(request())).status).toBe(200);
  expect(changeSharing).toHaveBeenLastCalledWith(true);
  expect((await DELETE(request())).status).toBe(200);
  expect(changeSharing).toHaveBeenLastCalledWith(false);
});
it("リンクが無効なら学習データを取得しない", async () => {
  vi.mocked(validShareToken).mockResolvedValue(false);
  expect(
    (await sharedGET(new Request("https://app.test/api/shared-study"))).status,
  ).toBe(404);
  expect(synchronize).not.toHaveBeenCalled();
});
it("共有リンクだけで要約を読めるが、同期中に停止したらデータを返さない", async () => {
  vi.mocked(validShareToken)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);
  vi.mocked(synchronize).mockResolvedValue({
    mode: "live",
    stale: false,
    records: [],
    goals: [],
    issues: [],
    duplicates: 0,
    syncedAt: "2026-10-24T00:00:00Z",
  });
  const req = new Request("https://app.test/api/shared-study", {
    headers: { Authorization: "Bearer fixture" },
  });
  expect((await sharedGET(req)).status).toBe(404);
  expect(synchronize).toHaveBeenCalledExactlyOnceWith(false);
  vi.mocked(validShareToken).mockResolvedValue(true);
  const response = await sharedGET(req);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({
    days: [],
    goals: [],
    syncedAt: "2026-10-24T00:00:00Z",
    stale: false,
  });
});
