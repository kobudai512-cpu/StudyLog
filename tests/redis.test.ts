import { afterEach, describe, expect, it, vi } from "vitest";
import { RedisStore, CACHE_SCRIPTS } from "@/lib/redis-store";
import { configuredStore } from "@/lib/store";
import { synchronize } from "@/lib/sync";
import type { CacheState } from "@/lib/cache-types";

// A shared Redis protocol fixture: requests from distinct workers share state.
function redisFixture() {
  const keys = new Map<string, string>();
  const request = vi.fn<typeof fetch>(async (_url, options) => {
    const [command, ...args] = JSON.parse(String(options?.body)) as (
      string | number
    )[];
    let result: unknown = null;
    if (command === "GET") result = keys.get(String(args[0])) ?? null;
    if (command === "SET" && !keys.has(String(args[0]))) {
      keys.set(String(args[0]), String(args[1]));
      result = "OK";
    }
    if (command === "EVAL") {
      const [script, count, ...rest] = args;
      const lock = String(rest[0]);
      const params = rest.slice(Number(count));
      const matches = keys.get(lock) === params[0];
      result = matches ? 1 : 0;
      if (matches && script === CACHE_SCRIPTS.write)
        keys.set(String(rest[1]), String(params[1]));
      if (matches && script === CACHE_SCRIPTS.release) keys.delete(lock);
    }
    return Response.json({ result });
  });
  const store = () =>
    new RedisStore(
      "https://redis.example.test",
      "private-test-token",
      "test",
      request,
    );
  return { keys, request, store };
}

afterEach(() => {
  vi.unstubAllEnvs();
});
describe("サーバーレスの共有キャッシュ", () => {
  it("共有リンク設定は7日キャッシュと分け、期限なしで保持する", async () => {
    const f = redisFixture();
    const store = new RedisStore(
      "https://redis.example.test",
      "fixture",
      "sharing",
      f.request,
      0,
    );
    const lease = await store.lock();
    await lease!.write({
      sharing: {
        tokenHash: "fixture",
        sealedToken: "encrypted",
        createdAt: "2026-10-24",
      },
    });
    const commands = f.request.mock.calls.map(([, options]) =>
      JSON.parse(String(options?.body)),
    );
    expect(commands).toContainEqual([
      "EVAL",
      CACHE_SCRIPTS.write,
      2,
      "sharing:lock",
      "sharing:state",
      expect.any(String),
      expect.any(String),
      0,
    ]);
    await lease!();
    expect((await store.read()).sharing?.sealedToken).toBe("encrypted");
  });
  it("別ワーカーと状態を共有し、同時同期は1件にする", async () => {
    const f = redisFixture();
    const a = await f.store().lock();
    expect(a).not.toBeNull();
    expect(await f.store().lock()).toBeNull();
    const state: CacheState = { lastAttempt: 1234 };
    await a!.write(state);
    expect(await f.store().read()).toEqual(state);
    await a!();
    const b = await f.store().lock();
    expect(b).not.toBeNull();
    await b!();
  });
  it("期限切れの古いワーカーは新しい状態を書き換えず、新しいロックも消さない", async () => {
    const f = redisFixture();
    const old = await f.store().lock();
    f.keys.delete("test:lock"); // Redis expired the original lease.
    const current = await f.store().lock();
    await current!.write({ lastAttempt: 200 });
    await expect(old!.write({ lastAttempt: 100 })).rejects.toThrow("有効期限");
    await old!();
    expect(await f.store().lock()).toBeNull();
    expect(await f.store().read()).toEqual({ lastAttempt: 200 });
    await current!();
  });
  it("解放後のリースは書き込めない", async () => {
    const f = redisFixture();
    const lease = await f.store().lock();
    await lease!();
    await expect(lease!.write({})).rejects.toThrow("有効期限");
  });
  it("書き込みは所有権確認と一緒に原子的に行い、保存期間を指定する", async () => {
    const f = redisFixture();
    const lease = await f.store().lock();
    await lease!.write({ lastAttempt: 1 });
    const commands = f.request.mock.calls.map(([, options]) =>
      JSON.parse(String(options?.body)),
    );
    expect(commands).toContainEqual([
      "EVAL",
      CACHE_SCRIPTS.write,
      2,
      "test:lock",
      "test:state",
      expect.any(String),
      JSON.stringify({ lastAttempt: 1 }),
      604800,
    ]);
    expect(f.request.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer private-test-token",
    });
    expect(f.request.mock.calls[0][1]?.cache).toBe("no-store");
    await lease!();
  });
  it("別インスタンスからの更新にも30秒制限を適用する", async () => {
    const f = redisFixture();
    const load = vi.fn().mockResolvedValue({
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
      },
    });
    await synchronize(false, f.store(), load);
    await synchronize(false, f.store(), load);
    expect(load).toHaveBeenCalledTimes(1);
    await expect(synchronize(true, f.store(), load)).rejects.toMatchObject({
      status: 429,
    });
  });
  it("接続エラーにプロバイダーやトークンの文字列を含めない", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("private-provider-payload", { status: 401 }),
      );
    const s = new RedisStore(
      "https://redis.example.test",
      "private-token",
      "test",
      request,
    );
    await expect(s.read()).rejects.toThrow(
      "共有キャッシュに接続できませんでした。",
    );
  });
  it("Vercelでファイルキャッシュへ黙って切り替えない", () => {
    vi.stubEnv("VERCEL", "1");
    for (const name of [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "KV_REST_API_URL",
      "KV_REST_API_TOKEN",
    ])
      vi.stubEnv(name, "");
    vi.stubEnv("CACHE_DIR", "/tmp/cache");
    expect(() => configuredStore()).toThrow("共有キャッシュ");
  });
  it("設定済みRedisをVercelで選択する", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    expect(configuredStore()).toBeInstanceOf(RedisStore);
  });
  it("平文HTTPの接続先を拒否", () => {
    expect(
      () => new RedisStore("http://redis.example.test", "token", "test"),
    ).toThrow("HTTPS");
  });
});
