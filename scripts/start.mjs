import { cp, access } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = fileURLToPath(new URL("../", import.meta.url));
// Load secrets from the project root before the standalone server changes cwd.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
nextRequire("@next/env").loadEnvConfig(root, false);
const standalone = join(root, ".next/standalone");
try {
  await access(join(standalone, "server.js"));
} catch {
  throw new Error("本番ビルドがありません。先にpnpm buildを実行してください。");
}
await cp(join(root, ".next/static"), join(standalone, ".next/static"), {
  recursive: true,
});
process.env.HOSTNAME ||= "127.0.0.1";
await import(pathToFileURL(join(standalone, "server.js")).href);
