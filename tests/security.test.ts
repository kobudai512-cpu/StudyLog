import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedEmail, sameOrigin } from "@/lib/auth-policy";
vi.mock("@/lib/auth", () => ({ authorized: vi.fn() }));
vi.mock("@/lib/sync", () => ({
  synchronize: vi.fn(),
  SyncError: class extends Error {
    status = 503;
  },
}));
import { authorized } from "@/lib/auth";
import { synchronize } from "@/lib/sync";
import { GET, POST } from "@/app/api/study/route";
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe("認証・API保護", () => {
  it("空リスト・部分一致を拒否", () => {
    expect(allowedEmail("me@example.com", "")).toBe(false);
    expect(allowedEmail("otherme@example.com", "me@example.com")).toBe(false);
    expect(allowedEmail("ME@example.com", " me@example.com ")).toBe(true);
  });
  it("GETとPOSTは未認証を拒否しNotionへアクセスしない", async () => {
    vi.mocked(authorized).mockResolvedValue(false);
    expect((await GET()).status).toBe(401);
    expect(
      (
        await POST(
          new Request("https://app.test/api/study", { method: "POST" }),
        )
      ).status,
    ).toBe(401);
    expect(synchronize).not.toHaveBeenCalled();
  });
  it("許可ユーザーでも他サイトからの更新を拒否", async () => {
    vi.stubEnv("NEXTAUTH_URL", "https://app.test");
    vi.mocked(authorized).mockResolvedValue(true);
    expect(
      (
        await POST(
          new Request("https://app.test/api/study", {
            method: "POST",
            headers: { origin: "https://evil.test" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(synchronize).not.toHaveBeenCalled();
  });
  it("Origin欠落・cross-siteを拒否", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://app.test");
    expect(sameOrigin(new Request("https://app.test"))).toBe(false);
    expect(
      sameOrigin(
        new Request("https://app.test", {
          headers: {
            origin: "https://app.test",
            "sec-fetch-site": "cross-site",
          },
        }),
      ),
    ).toBe(false);
  });
  it("同一Originの認証済みPOSTだけ更新する", async () => {
    vi.stubEnv("NEXTAUTH_URL", "https://app.test");
    vi.mocked(authorized).mockResolvedValue(true);
    vi.mocked(synchronize).mockResolvedValue({
      records: [],
      issues: [],
      duplicates: 0,
      mode: "live",
      stale: false,
      syncedAt: new Date().toISOString(),
    });
    const response = await POST(
      new Request("https://app.test/api/study", {
        method: "POST",
        headers: { origin: "https://app.test" },
      }),
    );
    expect(response.status).toBe(200);
    expect(synchronize).toHaveBeenCalledWith(true);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
