import { afterEach, expect, it, vi } from "vitest";
import { changeSharing, shareSettings, validShareToken } from "@/lib/sharing";
import { toSharedStudy } from "@/lib/shared-study";
import type { CacheState, CacheStore } from "@/lib/cache-types";
import type { StudyResponse } from "@/lib/study";

function fixture() {
  let state: CacheState = {};
  const store: CacheStore = {
    async read() {
      return structuredClone(state);
    },
    async lock() {
      return Object.assign(async () => {}, {
        async write(next: CacheState) {
          state = structuredClone(next);
        },
      });
    },
  };
  return { store, state: () => state };
}
afterEach(() => vi.unstubAllEnvs());
it("初期は共有オフ。リンクの保管は暗号化し、ハッシュで閲覧を検証する", async () => {
  vi.stubEnv("NEXTAUTH_SECRET", "fixture-secret");
  const f = fixture();
  expect(await shareSettings(f.store)).toEqual({ enabled: false, path: null });
  const result = await changeSharing(true, f.store);
  const token = result.path!.split("/").pop()!;
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(JSON.stringify(f.state())).not.toContain(token);
  expect(await validShareToken(token, f.store)).toBe(true);
  expect(await validShareToken("a".repeat(43), f.store)).toBe(false);
  expect(await validShareToken("invalid", f.store)).toBe(false);
  expect(await shareSettings(f.store)).toEqual(result);
});
it("別ワーカーでも停止と再発行を反映し、以前のリンクは復活しない", async () => {
  vi.stubEnv("NEXTAUTH_SECRET", "fixture-secret");
  const f = fixture();
  const first = (await changeSharing(true, f.store)).path!.split("/").pop()!;
  const second = (await changeSharing(true, f.store)).path!.split("/").pop()!;
  expect(await validShareToken(first, f.store)).toBe(false);
  expect(await validShareToken(second, f.store)).toBe(true);
  await changeSharing(false, f.store);
  expect(await validShareToken(second, f.store)).toBe(false);
  expect(await shareSettings(f.store)).toEqual({ enabled: false, path: null });
});
it("暗号化キー変更後も本人は共有停止と再発行ができる", async () => {
  vi.stubEnv("NEXTAUTH_SECRET", "before");
  const f = fixture();
  await changeSharing(true, f.store);
  vi.stubEnv("NEXTAUTH_SECRET", "after");
  expect(await shareSettings(f.store)).toEqual({ enabled: true, path: null });
  expect((await changeSharing(true, f.store)).path).toMatch(/^\/share\//);
  await changeSharing(false, f.store);
  expect((await shareSettings(f.store)).enabled).toBe(false);
});
it("日付またぎを日別・教科別に集計し、秘密の項目や実ページIDを一切返さない", () => {
  const response: StudyResponse = {
    mode: "live",
    stale: false,
    syncedAt: "2026-10-24T00:00:00Z",
    duplicates: 0,
    records: [
      {
        id: "private-page",
        date: "2026-10-24",
        subject: "数学",
        title: "PRIVATE_TITLE",
        unit: "PRIVATE_UNIT",
        notionUrl: "https://notion.so/private",
        updatedAt: "PRIVATE_UPDATED",
        durationMinutes: 90,
        endedAt: "2026-10-24T00:30:00+09:00",
      },
    ],
    issues: [{ id: "PRIVATE_ISSUE", reason: "PRIVATE_REASON" }],
    error: "PRIVATE_ERROR",
    goals: [
      {
        id: "PRIVATE_GOAL",
        weekStart: "2026-10-19",
        targetMinutes: 600,
        memo: "PRIVATE_MEMO",
        notionUrl: "https://notion.so/secret",
      },
    ],
  };
  const shared = toSharedStudy(response);
  expect(shared.days).toEqual([
    { date: "2026-10-23", subject: "数学", minutes: 60 },
    { date: "2026-10-24", subject: "数学", minutes: 30 },
  ]);
  expect(shared.goals).toEqual([
    { weekStart: "2026-10-19", targetMinutes: 600 },
  ]);
  expect(Object.keys(shared).sort()).toEqual([
    "days",
    "goals",
    "stale",
    "syncedAt",
  ]);
  expect(JSON.stringify(shared)).not.toMatch(/PRIVATE|private|notion|00:30/);
  expect(
    toSharedStudy({
      ...response,
      goals: [...response.goals!, ...response.goals!],
    }).goals,
  ).toEqual([]);
  expect(
    toSharedStudy({ ...response, goalError: "PRIVATE_ERROR" }).goals,
  ).toEqual([]);
});
