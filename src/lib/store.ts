import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  stat,
  utimes,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { CacheLease, CacheState, CacheStore } from "./cache-types";
import { RedisStore } from "./redis-store";
import { SOURCE_ID } from "./notion-schema";
export type { CacheState } from "./cache-types";
export class FileStore implements CacheStore {
  constructor(readonly directory: string) {}
  async read(): Promise<CacheState> {
    try {
      return JSON.parse(
        await readFile(join(this.directory, "state.json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw new Error("同期キャッシュを読み込めません。");
    }
  }
  async write(state: CacheState) {
    const temp = join(this.directory, `${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
    await rename(temp, join(this.directory, "state.json"));
  }
  async lock(): Promise<CacheLease | null> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const path = join(this.directory, "sync.lock");
    try {
      await mkdir(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      // Rename abandoned leases atomically before removal; active leases heartbeat every 10s.
      try {
        if (Date.now() - (await stat(path)).mtimeMs > 90000) {
          const abandoned = join(this.directory, `abandoned-${randomUUID()}`);
          await rename(path, abandoned);
          await rm(abandoned, { recursive: true });
          return this.lock();
        }
      } catch {
        /* Another process recovered the lease. */
      }
      return null;
    }
    const timer = setInterval(() => {
      const now = new Date();
      void utimes(path, now, now).catch(() => {});
    }, 10000);
    timer.unref();
    const release = async () => {
      clearInterval(timer);
      await rm(path, { recursive: true, force: true });
    };
    return Object.assign(release, { write: this.write.bind(this) });
  }
}
export function configuredStore(purpose = "sync"): CacheStore {
  const namespace = createHash("sha256")
    .update(
      (purpose === "sharing"
        ? [
            purpose,
            "v1",
            process.env.NOTION_DATA_SOURCE_ID || SOURCE_ID,
            process.env.NOTION_GOALS_DATA_SOURCE_ID,
            process.env.VERCEL_ENV,
          ]
        : purpose === "record-submissions"
          ? [
              purpose,
              process.env.NOTION_DATA_SOURCE_ID || SOURCE_ID,
              process.env.VERCEL_ENV,
            ]
          : [
              purpose,
              "v3-notion-goals-completion-time",
              process.env.NOTION_GOALS_DATA_SOURCE_ID,
              process.env.NOTION_GOALS_PROPERTY_IDS,
              process.env.NOTION_DATA_SOURCE_ID,
              process.env.NOTION_TOKEN,
              process.env.NOTION_PROPERTY_IDS,
              process.env.VERCEL_ENV,
            ]
      ).join(":"),
    )
    .digest("hex")
    .slice(0, 24);
  const redisUrl =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (redisUrl && redisToken)
    return new RedisStore(
      redisUrl,
      redisToken,
      `winkle:${namespace}`,
      fetch,
      purpose === "sharing" ? 0 : 604800,
    );
  if (redisUrl || redisToken || process.env.VERCEL === "1")
    throw new Error("共有キャッシュのREST URLとトークンを設定してください。");
  if (process.env.NODE_ENV === "production" && !process.env.CACHE_DIR)
    throw new Error("本番の永続キャッシュ（CACHE_DIR）が未設定です。");
  // Runtime-only private storage; never trace its contents into a deployable bundle.
  return new FileStore(
    join(
      /* turbopackIgnore: true */ resolve(
        /* turbopackIgnore: true */ process.env.CACHE_DIR || ".cache/notion",
      ),
      namespace,
    ),
  );
}
