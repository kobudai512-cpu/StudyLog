import type { StudyResponse } from "./study";
import { configuredStore } from "./store";
import type { CacheStore } from "./cache-types";
import { fetchNotion } from "./notion";
export class SyncError extends Error {
  constructor(
    message: string,
    readonly status = 503,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}
export async function synchronize(
  force = false,
  store: CacheStore = configuredStore(),
  load = fetchNotion,
): Promise<StudyResponse> {
  let state = await store.read();
  const respond = (stale: boolean, error?: string): StudyResponse => {
    if (!state.snapshot)
      throw new SyncError(error || "初回同期に失敗しました。");
    return { ...state.snapshot, mode: "live", stale, error };
  };
  if (
    !force &&
    state.snapshot &&
    Date.now() - Date.parse(state.snapshot.syncedAt) < 300000
  )
    return respond(Boolean(state.lastError), state.lastError);
  const unlock = await store.lock();
  if (!unlock)
    return respond(
      true,
      "別の同期処理が実行中です。少し待って更新してください。",
    );
  try {
    state = await store.read();
    if (
      !force &&
      state.snapshot &&
      Date.now() - Date.parse(state.snapshot.syncedAt) < 300000
    )
      return respond(Boolean(state.lastError), state.lastError);
    if (state.lastAttempt && Date.now() - state.lastAttempt < 30000) {
      if (force)
        throw new SyncError(
          "更新は30秒に1回までです。少し待って再試行してください。",
          429,
          30,
        );
      return respond(
        true,
        state.lastError || "同期処理の再試行を待っています。",
      );
    }
    state.lastAttempt = Date.now();
    await unlock.write(state);
    try {
      const result = await load(state.bindings, state.goalBindings);
      state = { ...result, lastAttempt: Date.now() };
      await unlock.write(state);
      return respond(false);
    } catch {
      // Provider messages may include private request context; expose a fixed safe message.
      state.lastError =
        "Notionの同期に失敗しました。トークン・読み取り権限・プロパティ対応を確認してください。";
      await unlock.write(state);
      return respond(true, state.lastError);
    }
  } finally {
    await unlock();
  }
}
