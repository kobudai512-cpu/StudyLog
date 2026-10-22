import type { Snapshot } from "./study";
import type { Bindings } from "./notion-schema";
import type { GoalBindings } from "./goals";

export type CacheState = {
  snapshot?: Snapshot;
  bindings?: Bindings;
  goalBindings?: GoalBindings;
  lastAttempt?: number;
  lastError?: string;
  invalidated?: boolean;
  retryNotBefore?: number;
  submissions?: Record<
    string,
    {
      hash: string;
      status: "pending" | "created" | "rejected" | "unknown";
      at: number;
      id?: string;
      notionUrl?: string;
    }
  >;
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
