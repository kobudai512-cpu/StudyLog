import { afterEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn() }));
vi.mock("@notionhq/client", () => ({
  LogLevel: { ERROR: "error" },
  Client: class {
    constructor(options: unknown) {
      sdk.options(options);
    }
    pages = { create: sdk.create };
  },
}));
import { createNotionRecord } from "@/lib/notion-write";
import { NOTION_VERSION } from "@/lib/notion-schema";
it("新しい教材名をselectとして記録と同時に保存する", async () => {
  sdk.create.mockResolvedValue({ id: "page", url: "https://notion.so/page" });
  await createNotionRecord(
    {
      title: "演習",
      subject: "数学",
      endedAt: "2026-10-24T00:00:00Z",
      durationMinutes: 60,
      unit: "",
      material: "新しい参考書",
    },
    {
      enabled: true,
      subjects: ["数学"],
      subjectIds: { 数学: "math" },
      hasUnit: false,
      hasMaterial: true,
      materials: [],
      bindings: {
        title: "t",
        date: "d",
        subject: "s",
        duration: "m",
        unit: "",
        material: "b",
      },
    },
  );
  expect(sdk.create).toHaveBeenCalledWith(
    expect.objectContaining({
      properties: expect.objectContaining({
        b: { select: { name: "新しい参考書" } },
      }),
    }),
  );
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("既存選択肢IDと固定データソースだけを使い、自動再送しない", async () => {
  vi.stubEnv("NOTION_DATA_SOURCE_ID", "study-only");
  vi.stubEnv("NOTION_WRITE_TOKEN", "fixture-write-token");
  sdk.create.mockResolvedValue({ id: "page", url: "https://notion.so/page" });
  await expect(
    createNotionRecord(
      {
        title: "演習",
        subject: "物理",
        endedAt: "2026-10-21T17:31:00.000Z",
        durationMinutes: 31,
        unit: "",
      },
      {
        enabled: true,
        subjects: ["物理"],
        subjectIds: { 物理: "option-id" },
        hasUnit: false,
        bindings: {
          title: "t",
          date: "d",
          subject: "s",
          duration: "m",
          unit: "",
        },
      },
    ),
  ).resolves.toEqual({ id: "page", notionUrl: "https://notion.so/page" });
  expect(sdk.options).toHaveBeenCalledWith(
    expect.objectContaining({
      auth: "fixture-write-token",
      notionVersion: NOTION_VERSION,
      retry: false,
    }),
  );
  expect(sdk.create).toHaveBeenCalledExactlyOnceWith({
    parent: { type: "data_source_id", data_source_id: "study-only" },
    properties: {
      t: { title: [{ text: { content: "演習" } }] },
      s: { select: { id: "option-id" } },
      d: { date: { start: "2026-10-21T17:31:00.000Z" } },
      m: { number: 31 },
    },
  });
});
