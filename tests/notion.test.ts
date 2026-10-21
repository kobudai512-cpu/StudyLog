import { describe, expect, it, vi } from "vitest";
import {
  FIELDS,
  normalizePages,
  resolveBindings,
  type Bindings,
  type RawPage,
} from "@/lib/notion-schema";
import { queryAll, retryingFetch } from "@/lib/notion";
const bindings: Bindings = {
  title: "t",
  date: "d",
  subject: "s",
  duration: "m",
  unit: "u",
};
const makePage = (): RawPage => ({
  id: "one",
  url: "https://app.notion.com/p/one",
  last_edited_time: "2026-10-22T00:00:00Z",
  properties: {
    renamedTitle: { id: "t", type: "title", title: [{ plain_text: "微分" }] },
    renamedDate: { id: "d", type: "date", date: { start: "2026-10-22" } },
    renamedSubject: { id: "s", type: "select", select: { name: "数学" } },
    renamedMinutes: { id: "m", type: "number", number: 90 },
    unit: { id: "u", type: "rich_text", rich_text: [] },
  },
});
describe("Notionスキーマと正規化", () => {
  it("表示名変更後もIDで解決", () => {
    const schema = Object.fromEntries(
      Object.entries(FIELDS).map(([field, v]) => [
        field,
        {
          id: bindings[field as keyof Bindings],
          type: v.type,
          name: "renamed",
        },
      ]),
    );
    expect(resolveBindings(schema, bindings)).toEqual(bindings);
    expect(
      normalizePages([makePage()], bindings).records[0].durationMinutes,
    ).toBe(90);
  });
  it("型不一致を拒否", () =>
    expect(() =>
      resolveBindings(
        { duration: { id: "m", type: "rich_text", name: "学習時間（分）" } },
        bindings,
      ),
    ).toThrow());
  it.each([null, -1, NaN, Infinity, undefined])(
    "不正時間を0分にしない: %s",
    (value) => {
      const p = makePage();
      p.properties.renamedMinutes.number = value;
      const a = normalizePages([p], bindings);
      expect(a.records).toHaveLength(0);
      expect(a.issues).toHaveLength(1);
    },
  );
  it("教科空白は未分類", () => {
    const p = makePage();
    p.properties.renamedSubject.select = null;
    expect(normalizePages([p], bindings).records[0].subject).toBe("未分類");
  });
  it("日付空白・複数日範囲は除外", () => {
    const p = makePage();
    p.properties.renamedDate.date = null;
    expect(normalizePages([p], bindings).issues).toHaveLength(1);
    p.properties.renamedDate.date = { start: "2026-10-20", end: "2026-10-22" };
    expect(normalizePages([p], bindings).records).toHaveLength(0);
  });
  it("重複とアーカイブを除外", () => {
    const p = makePage();
    expect(normalizePages([p, p], bindings).duplicates).toBe(1);
    p.archived = true;
    expect(normalizePages([p], bindings).records).toHaveLength(0);
  });
  it("プロパティ型が変わった行を除外", () => {
    const p = makePage();
    p.properties.renamedMinutes.type = "formula";
    expect(normalizePages([p], bindings).issues).toHaveLength(1);
  });
});
describe("取得の完全性", () => {
  it("opaque cursorで最後まで取得", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        results: [makePage()],
        has_more: true,
        next_cursor: "opaque:abc",
      })
      .mockResolvedValueOnce({
        results: [{ ...makePage(), id: "two" }],
        has_more: false,
        next_cursor: null,
      });
    expect(await queryAll(query, "source", ["t"])).toHaveLength(2);
    expect(query.mock.calls[1][0].start_cursor).toBe("opaque:abc");
  });
  it("上限に達したら重ならないtimestamp範囲に分割", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        results: [],
        has_more: false,
        next_cursor: null,
        request_status: { type: "incomplete" },
      })
      .mockResolvedValue({
        results: [makePage()],
        has_more: false,
        next_cursor: null,
      });
    expect(await queryAll(query, "source", ["t"], 0, 100)).toHaveLength(2);
    expect(query.mock.calls[1][0].filter.and[1].created_time.before).toBe(
      new Date(50).toISOString(),
    );
    expect(query.mock.calls[2][0].filter.and[0].created_time.on_or_after).toBe(
      new Date(50).toISOString(),
    );
  });
  it("繰り返されるcursorは成功扱いしない", async () => {
    const q = vi
      .fn()
      .mockResolvedValue({ results: [], has_more: true, next_cursor: "same" });
    await expect(queryAll(q, "s", [])).rejects.toThrow();
  });
  it("429のRetry-Afterを尊重し、リトライ数を制限", async () => {
    const base = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response("{}", { status: 429, headers: { "Retry-After": "2" } }),
        ),
      );
    const wait = vi.fn().mockResolvedValue(undefined);
    expect(
      (await retryingFetch(base, wait)("https://api.notion.com")).status,
    ).toBe(429);
    expect(base).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls[0][0]).toBeGreaterThanOrEqual(2000);
  });
  it("長いRetry-Afterを切り詰めて再試行しない", async () => {
    const base = vi
      .fn()
      .mockResolvedValue(
        new Response("{}", { status: 429, headers: { "Retry-After": "120" } }),
      );
    const wait = vi.fn();
    await retryingFetch(base, wait)("https://api.notion.com");
    expect(base).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
  it("401は再試行しない", async () => {
    const base = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    await retryingFetch(base)("https://api.notion.com");
    expect(base).toHaveBeenCalledTimes(1);
  });
});
