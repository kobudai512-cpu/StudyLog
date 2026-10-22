import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ authorized: vi.fn() }));
vi.mock("@/lib/notion-write", () => ({
  writingEnabled: () => true,
  recordSchema: vi.fn(),
}));
vi.mock("@/lib/record-writer", () => ({ submitRecord: vi.fn() }));
vi.mock("@/lib/sync", () => ({
  invalidateStudy: vi.fn().mockResolvedValue(true),
}));
import { authorized } from "@/lib/auth";
import { submitRecord } from "@/lib/record-writer";
import { GET, POST } from "@/app/api/records/route";
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
function request(
  body: string,
  origin = "https://app.test",
  type = "application/json",
) {
  return new Request("https://app.test/api/records", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": type,
      "Idempotency-Key": "test",
    },
    body,
  });
}
describe("記録APIの境界", () => {
  it("未認証のGET/POSTはNotionへアクセスしない", async () => {
    vi.mocked(authorized).mockResolvedValue(false);
    expect((await GET()).status).toBe(401);
    expect((await POST(request("{}"))).status).toBe(401);
    expect(submitRecord).not.toHaveBeenCalled();
  });
  it("クロスオリジン・不正JSON・過大な入力・別Content-Typeを拒否", async () => {
    vi.mocked(authorized).mockResolvedValue(true);
    vi.stubEnv("NEXTAUTH_URL", "https://app.test");
    expect((await POST(request("{}", "https://evil.test"))).status).toBe(403);
    expect((await POST(request("invalid"))).status).toBe(400);
    expect((await POST(request("x".repeat(9000)))).status).toBe(413);
    expect(
      (await POST(request("{}", "https://app.test", "text/plain"))).status,
    ).toBe(415);
    expect(submitRecord).not.toHaveBeenCalled();
  });
  it("本人の有効送信だけを保存処理へ渡す", async () => {
    vi.mocked(authorized).mockResolvedValue(true);
    vi.stubEnv("NEXTAUTH_URL", "https://app.test");
    vi.mocked(submitRecord).mockResolvedValue({
      id: "saved",
      notionUrl: "https://app.notion.com/p/saved",
    });
    const response = await POST(request('{"title":"演習"}'));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(submitRecord).toHaveBeenCalledWith({ title: "演習" }, "test");
  });
});
