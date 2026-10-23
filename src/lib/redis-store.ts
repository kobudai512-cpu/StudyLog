import { randomUUID } from "node:crypto";
import type { CacheLease, CacheState, CacheStore } from "./cache-types";

const LEASE_MS = 60000;
const RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const CACHE_SCRIPTS = {
  write: `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if tonumber(ARGV[3]) > 0 then
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
else
redis.call('SET', KEYS[2], ARGV[2])
end
return 1`,
  renew: `if redis.call('GET', KEYS[1]) == ARGV[1] then
return redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return 0`,
  release: `if redis.call('GET', KEYS[1]) == ARGV[1] then
return redis.call('DEL', KEYS[1]) end
return 0`,
} as const;

// Upstash-compatible REST protocol. All commands and credentials remain server-side.
export class RedisStore implements CacheStore {
  private readonly endpoint: string;
  constructor(
    url: string,
    private readonly token: string,
    private readonly prefix: string,
    private readonly request: typeof fetch = fetch,
    private readonly retentionSeconds = RETENTION_SECONDS,
  ) {
    const endpoint = new URL(url);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password
    )
      throw new Error("共有キャッシュはHTTPSのREST URLで設定してください。");
    this.endpoint = endpoint.href;
  }

  private async command(args: (string | number)[]): Promise<unknown> {
    try {
      const response = await this.request(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error();
      const body: { result?: unknown; error?: unknown } = await response.json();
      if (body.error || !("result" in body)) throw new Error();
      return body.result;
    } catch {
      // Never propagate a provider response that could include auth/request data.
      throw new Error("共有キャッシュに接続できませんでした。");
    }
  }

  async read(): Promise<CacheState> {
    const value = await this.command(["GET", `${this.prefix}:state`]);
    if (value === null) return {};
    if (typeof value !== "string")
      throw new Error("共有キャッシュの形式が不正です。");
    try {
      const state: CacheState = JSON.parse(value);
      if (!state || typeof state !== "object") throw new Error();
      return state;
    } catch {
      throw new Error("共有キャッシュの形式が不正です。");
    }
  }

  async lock(): Promise<CacheLease | null> {
    const key = `${this.prefix}:lock`;
    const owner = randomUUID();
    const acquired = await this.command([
      "SET",
      key,
      owner,
      "NX",
      "PX",
      LEASE_MS,
    ]);
    if (acquired !== "OK") return null;
    let lost = false;
    let closed = false;
    const timer = setInterval(() => {
      void this.command(["EVAL", CACHE_SCRIPTS.renew, 1, key, owner, LEASE_MS])
        .then((result) => {
          if (result !== 1) lost = true;
        })
        .catch(() => {
          lost = true;
        });
    }, 15000);
    timer.unref();
    const release = async () => {
      closed = true;
      clearInterval(timer);
      await this.command(["EVAL", CACHE_SCRIPTS.release, 1, key, owner]);
    };
    return Object.assign(release, {
      write: async (state: CacheState) => {
        if (closed || lost)
          throw new Error("同期ロックの有効期限が切れました。");
        const saved = await this.command([
          "EVAL",
          CACHE_SCRIPTS.write,
          2,
          key,
          `${this.prefix}:state`,
          owner,
          JSON.stringify(state),
          this.retentionSeconds,
        ]);
        if (saved !== 1) {
          lost = true;
          throw new Error("同期ロックの有効期限が切れました。");
        }
      },
    });
  }
}
