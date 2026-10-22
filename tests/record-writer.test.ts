import { afterEach, describe, expect, it, vi } from "vitest";
import type { CacheState, CacheStore } from "@/lib/cache-types";
import { submitRecord } from "@/lib/record-writer";
import { parseRecordInput } from "@/lib/record-input";
const input = {
  title: "物理の演習",
  subject: "物理",
  endedAt: "2026-10-22T02:31:00+09:00",
  durationMinutes: 31,
  unit: "",
};
const key = "11111111-1111-4111-8111-111111111111";
const schema = {
  enabled: true,
  subjects: ["物理"],
  subjectIds: { 物理: "physics" },
  hasUnit: false,
  bindings: { title: "t", date: "d", duration: "m", subject: "s", unit: "" },
};
function fixture() {
  let state: CacheState = {};
  let locked = false;
  const store: CacheStore = {
    async read() {
      return structuredClone(state);
    },
    async lock() {
      if (locked) return null;
      locked = true;
      return Object.assign(
        async () => {
          locked = false;
        },
        {
          async write(next: CacheState) {
            state = structuredClone(next);
          },
        },
      );
    },
  };
  const load = vi.fn().mockResolvedValue(schema);
  const create = vi
    .fn()
    .mockResolvedValue({
      id: "notion-id",
      notionUrl: "https://app.notion.com/p/notion-id",
    });
  return { store, load, create };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("記録入力と安全な保存", () => {
  it.each([
    { durationMinutes: 0 },
    { durationMinutes: -1 },
    { durationMinutes: 1.5 },
    { durationMinutes: 1441 },
    { title: " " },
    { endedAt: "2026-10-22T02:31" },
    { endedAt: "2099-01-01T00:00:00Z" },
    { sourceId: "other" },
  ])("不正・別データソースの指定を拒否 %j", (change) => {
    expect(() => parseRecordInput({ ...input, ...change })).toThrow();
  });
  it("時刻をUTCへ正規化し余白を除去", () => {
    expect(parseRecordInput({ ...input, title: " 演習 " })).toMatchObject({
      title: "演習",
      endedAt: "2026-10-21T17:31:00.000Z",
    });
  });
  it("書き込みが無効なら作成しない", async () => {
    const f = fixture();
    await expect(
      submitRecord(input, key, f.store, f.load, f.create),
    ).rejects.toMatchObject({ status: 503 });
    expect(f.create).not.toHaveBeenCalled();
  });
  it("同じIDは別インスタンスからでも再作成しない、内容変更を拒否", async () => {
    vi.stubEnv("NOTION_WRITE_ENABLED", "true");
    const f = fixture();
    const first = await submitRecord(input, key, f.store, f.load, f.create);
    expect(await submitRecord(input, key, f.store, f.load, f.create)).toEqual(
      first,
    );
    await expect(
      submitRecord(
        { ...input, title: "別内容" },
        key,
        f.store,
        f.load,
        f.create,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it("同時送信を抑止", async () => {
    vi.stubEnv("NOTION_WRITE_ENABLED", "true");
    const f = fixture();
    let complete!: (value: unknown) => void;
    f.create.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const first = submitRecord(input, key, f.store, f.load, f.create);
    await vi.waitFor(() => expect(f.create).toHaveBeenCalledTimes(1));
    await expect(
      submitRecord(input, key, f.store, f.load, f.create),
    ).rejects.toMatchObject({ status: 429 });
    complete({ id: "created", notionUrl: "https://app.notion.com/p/created" });
    await first;
  });
  it("タイムアウト・5xxでは自動再送も手動同一ID再送も作成しない", async () => {
    vi.stubEnv("NOTION_WRITE_ENABLED", "true");
    const f = fixture();
    f.create.mockRejectedValueOnce(new Error("PRIVATE_PROVIDER_DATA"));
    await expect(
      submitRecord(input, key, f.store, f.load, f.create),
    ).rejects.toMatchObject({ uncertain: true });
    await expect(
      submitRecord(input, key, f.store, f.load, f.create),
    ).rejects.toMatchObject({ uncertain: true });
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it("429のRetry-After以前には再実行しない", async () => {
    vi.stubEnv("NOTION_WRITE_ENABLED", "true");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T00:00:00Z"));
    const f = fixture();
    f.create.mockRejectedValueOnce({
      status: 429,
      headers: new Headers({ "Retry-After": "120" }),
    });
    await expect(
      submitRecord(input, key, f.store, f.load, f.create),
    ).rejects.toMatchObject({ status: 429, retryAfter: 120 });
    vi.setSystemTime(Date.now() + 11000);
    await expect(
      submitRecord(input, key, f.store, f.load, f.create),
    ).rejects.toMatchObject({ status: 429, retryAfter: 109 });
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it("スキーマにない教科や単元は作成しない", async () => {
    vi.stubEnv("NOTION_WRITE_ENABLED", "true");
    const f = fixture();
    await expect(
      submitRecord(
        { ...input, subject: "存在しない科目" },
        key,
        f.store,
        f.load,
        f.create,
      ),
    ).rejects.toThrow();
    await expect(
      submitRecord({ ...input, unit: "単元" }, key, f.store, f.load, f.create),
    ).rejects.toThrow();
    expect(f.create).not.toHaveBeenCalled();
  });
});
