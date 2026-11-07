// Derive every raster icon from the SVG using Next.js's existing Sharp dependency.
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const source = await readFile(new URL("../src/app/icon.svg", import.meta.url));
const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map((size) =>
    sharp(source, { density: 288 }).resize(size, size).png().toBuffer(),
  ),
);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i];
  header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(
  new URL("../src/app/favicon.ico", import.meta.url),
  Buffer.concat([header, ...images]),
);
// iOS applies its own mask; provide an opaque background beneath the SVG corners.
await sharp(source, { density: 288 })
  .resize(180, 180)
  .flatten({ background: "#315da8" })
  .png()
  .toFile(
    fileURLToPath(new URL("../src/app/apple-icon.png", import.meta.url)),
  );
