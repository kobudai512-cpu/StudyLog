import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { configuredStore } from "./store";
import type { CacheStore } from "./cache-types";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
function encryptionKey() {
  if (!process.env.NEXTAUTH_SECRET)
    throw new Error("共有設定の暗号化キーが未設定です。");
  return createHash("sha256")
    .update(`studylog-share:${process.env.NEXTAUTH_SECRET}`)
    .digest();
}
const hash = (token: string) => createHash("sha256").update(token).digest();
function seal(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
function unseal(value: string) {
  const bytes = Buffer.from(value, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
export async function shareSettings(
  store: CacheStore = configuredStore("sharing"),
) {
  const sharing = (await store.read()).sharing;
  if (!sharing) return { enabled: false, path: null };
  try {
    const token = unseal(sharing.sealedToken);
    if (
      !tokenPattern.test(token) ||
      hash(token).toString("hex") !== sharing.tokenHash
    )
      throw new Error();
    return { enabled: true, path: `/share/${token}` };
  } catch {
    // A rotated server secret must not prevent the owner from revoking/replacing a link.
    return { enabled: true, path: null };
  }
}
export async function changeSharing(
  enabled: boolean,
  store: CacheStore = configuredStore("sharing"),
) {
  const lease = await store.lock();
  if (!lease)
    throw new Error("共有設定を更新中です。少し待って再試行してください。");
  try {
    if (!enabled) {
      await lease.write({});
      return { enabled: false, path: null };
    }
    const token = randomBytes(32).toString("base64url");
    await lease.write({
      sharing: {
        tokenHash: hash(token).toString("hex"),
        sealedToken: seal(token),
        createdAt: new Date().toISOString(),
      },
    });
    return { enabled: true, path: `/share/${token}` };
  } finally {
    await lease();
  }
}
export async function validShareToken(
  token: string,
  store: CacheStore = configuredStore("sharing"),
) {
  if (!tokenPattern.test(token)) return false;
  const sharing = (await store.read()).sharing;
  if (!sharing || !/^[a-f0-9]{64}$/.test(sharing.tokenHash)) return false;
  return timingSafeEqual(hash(token), Buffer.from(sharing.tokenHash, "hex"));
}
