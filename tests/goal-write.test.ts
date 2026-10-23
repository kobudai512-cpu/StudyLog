import { afterEach, expect, it, vi } from "vitest";
import { parseGoalInput } from "@/lib/goal-input";
import { resolveGoalBindings } from "@/lib/goals";
const sdk = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  query: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock("@notionhq/client", () => ({
  LogLevel: { ERROR: "error" },
  Client: class {
    pages = { create: sdk.create, update: sdk.update };
    dataSources = { query: sdk.query, retrieve: sdk.retrieve };
  },
}));
import { goalSchema, saveNotionGoal } from "@/lib/goal-write";
import { submitGoal } from "@/lib/goal-writer";
import type { CacheState, CacheStore } from "@/lib/cache-types";
const input = { weekStart: "2026-10-19", targetMinutes: 750 };
const properties = {
  w: { id: "w", name: "週の開始日", type: "date" },
  t: { id: "t", name: "目標時間（分）", type: "number" },
  m: { id: "m", name: "テキスト", type: "rich_text" },
  title: { id: "title", name: "目標名", type: "title" },
};
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("実接続のテキスト項目に対応する", () => {
  expect(resolveGoalBindings(properties)).toEqual({
    week: "w",
    target: "t",
    memo: "m",
  });
});
it.each([
  { weekStart: "2026-10-20" },
  { weekStart: "2026-02-30" },
  { targetMinutes: 0 },
  { targetMinutes: 10081 },
  { targetMinutes: 1.5 },
  { targetMinutes: "600" },
])("無効な週と時間を拒否 %j", (change) => {
  expect(() => parseGoalInput({ ...input, ...change })).toThrow();
});
async function schema() {
  sdk.retrieve.mockResolvedValue({ properties });
  return goalSchema();
}
it("未設定の週のみ作成し、時間＋分の合計を分で保存", async () => {
  sdk.query.mockResolvedValue({ results: [], has_more: false });
  sdk.create.mockResolvedValue({ id: "new", url: "https://notion.so/new" });
  await saveNotionGoal(input, await schema());
  expect(sdk.create).toHaveBeenCalledWith(
    expect.objectContaining({
      properties: {
        t: { number: 750 },
        w: { date: { start: input.weekStart } },
        title: {
          title: [{ text: { content: `${input.weekStart} の週の目標` } }],
        },
      },
    }),
  );
  expect(sdk.update).not.toHaveBeenCalled();
});
it("既存週は時間だけ更新し、目標名やメモを上書きしない", async () => {
  sdk.query.mockResolvedValue({
    results: [{ id: "existing" }],
    has_more: false,
  });
  sdk.update.mockResolvedValue({
    id: "existing",
    url: "https://notion.so/existing",
  });
  await saveNotionGoal(input, await schema());
  expect(sdk.update).toHaveBeenCalledExactlyOnceWith({
    page_id: "existing",
    properties: { t: { number: 750 } },
  });
  expect(sdk.create).not.toHaveBeenCalled();
});
it("重複週と不完全な取得では保存しない", async () => {
  const s = await schema();
  for (const response of [
    { results: [{ id: "a" }, { id: "b" }], has_more: false },
    { results: [], has_more: false, request_status: { type: "incomplete" } },
  ]) {
    sdk.query.mockResolvedValue(response);
    await expect(saveNotionGoal(input, s)).rejects.toThrow();
  }
  expect(sdk.create).not.toHaveBeenCalled();
  expect(sdk.update).not.toHaveBeenCalled();
});
it("二重送信を抑止し、結果不明の送信は再実行しない", async () => {
  vi.stubEnv("NOTION_WRITE_ENABLED", "true");
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
  const load = vi.fn().mockResolvedValue({});
  const create = vi
    .fn()
    .mockResolvedValue({ id: "new", notionUrl: "https://notion.so/new" });
  const key = "11111111-1111-4111-8111-111111111111";
  await submitGoal(input, key, store, load, create);
  await submitGoal(input, key, store, load, create);
  expect(create).toHaveBeenCalledTimes(1);
  state = {};
  create.mockRejectedValue(new Error("timeout"));
  await expect(
    submitGoal(input, key, store, load, create),
  ).rejects.toMatchObject({ uncertain: true });
  await expect(
    submitGoal(input, key, store, load, create),
  ).rejects.toMatchObject({ uncertain: true });
  expect(create).toHaveBeenCalledTimes(2);
});
