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
import type { Snapshot } from "./study";
import type { Bindings } from "./notion-schema";
export type CacheState = {
  snapshot?: Snapshot;
  bindings?: Bindings;
  lastAttempt?: number;
  lastError?: string;
};
export class FileStore {
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
  async lock(): Promise<null | (() => Promise<void>)> {
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
    return async () => {
      clearInterval(timer);
      await rm(path, { recursive: true, force: true });
    };
  }
}
export function configuredStore() {
  if (process.env.NODE_ENV === "production" && !process.env.CACHE_DIR)
    throw new Error("本番の永続キャッシュ（CACHE_DIR）が未設定です。");
  const namespace = createHash("sha256")
    .update(
      [
        process.env.NOTION_DATA_SOURCE_ID,
        process.env.NOTION_TOKEN,
        process.env.NOTION_PROPERTY_IDS,
      ].join(":"),
    )
    .digest("hex")
    .slice(0, 24);
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
