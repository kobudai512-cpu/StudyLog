import { expect, it, vi, afterEach } from "vitest";
import {
  changeWidget,
  validWidgetToken,
  widgetSettings,
  widgetSummary,
} from "@/lib/widget";
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
        async write(s: CacheState) {
          state = structuredClone(s);
        },
      });
    },
  };
  return { store, state: () => state };
}
afterEach(() => vi.unstubAllEnvs());
it("stores only a hash, rotates and revokes independently from sharing", async () => {
  const f = fixture();
  const first = (await changeWidget(true, f.store)).token!;
  expect(await validWidgetToken(first, f.store)).toBe(true);
  expect(JSON.stringify(f.state())).not.toContain(first);
  expect(await widgetSettings(f.store)).not.toHaveProperty("token");
  const second = (await changeWidget(true, f.store)).token!;
  expect(await validWidgetToken(first, f.store)).toBe(false);
  expect(await validWidgetToken(second.slice(3), f.store)).toBe(false);
  await changeWidget(false, f.store);
  expect(await validWidgetToken(second, f.store)).toBe(false);
});
it("rejects malformed requests before opening storage", async () => {
  vi.stubEnv("VERCEL", "1");
  expect(await validWidgetToken("invalid")).toBe(false);
});
it("splits Sunday midnight records at the Tokyo week boundary without exposing private fields", () => {
  const study: StudyResponse = {
    mode: "live",
    stale: false,
    syncedAt: "2026-11-08T15:30:00Z",
    duplicates: 0,
    issues: [],
    records: [
      {
        id: "PRIVATE",
        title: "PRIVATE",
        subject: "PRIVATE",
        notionUrl: "PRIVATE",
        updatedAt: "PRIVATE",
        date: "2026-11-09",
        durationMinutes: 90,
        endedAt: "2026-11-09T00:30:00+09:00",
      },
    ],
    goals: [
      {
        id: "PRIVATE",
        notionUrl: "PRIVATE",
        weekStart: "2026-11-09",
        targetMinutes: 600,
      },
    ],
  };
  const result = widgetSummary(study, new Date("2026-11-08T15:30:00Z"));
  expect(result).toEqual({
    weekStart: "2026-11-09",
    weekEnd: "2026-11-15",
    minutes: 30,
    targetMinutes: 600,
    syncedAt: study.syncedAt,
    stale: false,
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(widgetSummary(study, new Date("2026-11-08T14:59:00Z")).minutes).toBe(
    60,
  );
  expect(
    widgetSummary({ ...study, goalError: "PRIVATE" }).targetMinutes,
  ).toBeNull();
});
