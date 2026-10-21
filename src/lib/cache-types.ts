import type { Snapshot } from "./study";
import type { Bindings } from "./notion-schema";

export type CacheState = {
  snapshot?: Snapshot;
  bindings?: Bindings;
  lastAttempt?: number;
  lastError?: string;
};

// The write operation belongs to the acquired lease, so an expired worker
// cannot write using a newer request's ownership token.
export type CacheLease = (() => Promise<void>) & {
  write(state: CacheState): Promise<void>;
};

export interface CacheStore {
  read(): Promise<CacheState>;
  lock(): Promise<CacheLease | null>;
}
