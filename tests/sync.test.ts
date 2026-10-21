import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileStore } from "@/lib/store";
import { synchronize } from "@/lib/sync";
import type { Bindings } from "@/lib/notion-schema";
const folders: string[] = [];
async function store() {
  const folder = await mkdtemp(join(tmpdir(), "winkle-test-"));
  folders.push(folder);
  return new FileStore(folder);
}
const result = () => ({
  snapshot: {
    records: [],
    issues: [],
    duplicates: 0,
    syncedAt: new Date().toISOString(),
  },
  bindings: {
    title: "t",
    date: "d",
    subject: "s",
    duration: "m",
    unit: "u",
  } as Bindings,
});
afterEach(async () => {
  for (const f of folders.splice(0))
    await rm(f, { recursive: true, force: true });
});
describe("永続キャッシュ・同期", () => {
  it("別のStoreインスタンスでも5分以内のデータを再利用", async () => {
    const s = await store();
    const load = vi.fn().mockResolvedValue(result());
    await synchronize(false, s, load);
    await synchronize(false, new FileStore(s.directory), load);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("同期失敗時は前回の成功時刻を保持しstaleを表示", async () => {
    const s = await store();
    const unlock = await s.lock();
    const old = result();
    old.snapshot.syncedAt = "2026-01-01T00:00:00Z";
    await s.write(old);
    await unlock!();
    const a = await synchronize(
      false,
      s,
      vi.fn().mockRejectedValue(new Error("SECRET")),
    );
    expect(a.stale).toBe(true);
    expect(a.syncedAt).toBe(old.snapshot.syncedAt);
    expect(a.error).not.toContain("SECRET");
  });
  it("初回失敗をデモに置き換えない", async () => {
    const s = await store();
    await expect(
      synchronize(false, s, vi.fn().mockRejectedValue(new Error())),
    ).rejects.toThrow("Notion");
  });
  it("明示更新を30秒で制限", async () => {
    const s = await store();
    await synchronize(false, s, vi.fn().mockResolvedValue(result()));
    await expect(synchronize(true, s)).rejects.toMatchObject({ status: 429 });
  });
  it("別プロセス相当の同時ロックを抑止", async () => {
    const s = await store();
    const release = await s.lock();
    expect(await new FileStore(s.directory).lock()).toBeNull();
    await release!();
    const second = await s.lock();
    expect(second).not.toBeNull();
    await second!();
  });
});
