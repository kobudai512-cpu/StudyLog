import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { CacheStore } from "./cache-types";
import { configuredStore } from "./store";
import { toSharedStudy } from "./shared-study";
import { addDays, monday, tokyoDate, type StudyResponse } from "./study";

const hash = (token: string) => createHash("sha256").update(token).digest();
export async function widgetSettings(store = configuredStore("widget")) {
  const { widget } = await store.read();
  return { enabled: !!widget, createdAt: widget?.createdAt ?? null };
}
export async function changeWidget(
  enabled: boolean,
  store = configuredStore("widget"),
) {
  const lease = await store.lock();
  if (!lease) throw new Error("Busy");
  try {
    if (!enabled) {
      await lease.write({});
      return { enabled: false, createdAt: null };
    }
    const token = `ws_${randomBytes(32).toString("base64url")}`;
    const createdAt = new Date().toISOString();
    await lease.write({
      widget: { tokenHash: hash(token).toString("hex"), createdAt },
    });
    return { enabled: true, createdAt, token };
  } finally {
    await lease();
  }
}
export async function validWidgetToken(token: string, store?: CacheStore) {
  if (!/^ws_[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const { widget } = await (store ?? configuredStore("widget")).read();
  if (!widget || !/^[a-f0-9]{64}$/.test(widget.tokenHash)) return false;
  return timingSafeEqual(hash(token), Buffer.from(widget.tokenHash, "hex"));
}
export function widgetSummary(study: StudyResponse, now = new Date()) {
  const weekStart = monday(tokyoDate(now));
  const weekEnd = addDays(weekStart, 6);
  const data = toSharedStudy(study);
  const minutes = data.days
    .filter((d) => d.date >= weekStart && d.date <= weekEnd)
    .reduce((sum, d) => sum + d.minutes, 0);
  const target = data.goals.find(
    (g) => g.weekStart === weekStart,
  )?.targetMinutes;
  return {
    weekStart,
    weekEnd,
    minutes: Math.round(minutes),
    targetMinutes:
      typeof target === "number" && Number.isFinite(target) && target > 0
        ? target
        : null,
    syncedAt: data.syncedAt,
    stale: data.stale,
  };
}
