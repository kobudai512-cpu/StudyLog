import { chown, mkdir } from "node:fs/promises";
import { isAbsolute } from "node:path";

const cache = process.env.CACHE_DIR;
if (!cache || !isAbsolute(cache)) {
  throw new Error("CACHE_DIR must be an absolute persistent directory.");
}

// A freshly mounted host volume hides the directory ownership from the image.
// Prepare only its root, then run the application as the image's node user.
await mkdir(cache, { recursive: true, mode: 0o700 });
if (process.getuid?.() === 0) {
  await chown(cache, 1000, 1000);
  process.setgid(1000);
  process.setuid(1000);
}

await import("./server.js");
