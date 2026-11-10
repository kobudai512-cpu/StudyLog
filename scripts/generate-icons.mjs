// Derive every raster icon from the SVG using Next.js's existing Sharp dependency.
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
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
  .flatten({ background: "#ffffff" })
  .png()
  .toFile(fileURLToPath(new URL("../src/app/apple-icon.png", import.meta.url)));

// Home-screen icons must not snapshot the favicon's dark-mode media query.
// Keep an opaque dark icon and leave room for Android launcher masks.
const book = await readFile(
  new URL("../android/app/src/main/res/drawable/book.xml", import.meta.url),
  "utf8",
);
const bookPath = book.match(/android:pathData="([^"]+)"/)[1];
const launcher = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" fill="#111"/><path d="${bookPath}" fill="#fff" fill-rule="evenodd"/></svg>`,
);
await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  await sharp(launcher)
    .resize(size, size)
    .png()
    .toFile(
      fileURLToPath(
        new URL(`../public/icons/home-dark-v2-${size}.png`, import.meta.url),
      ),
    );
}

// Theme masks contain only the book silhouette; the surrounding tile is transparent.
const monochrome = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><path d="${bookPath}" fill="#fff" fill-rule="evenodd"/></svg>`,
);
for (const size of [192, 512]) {
  await sharp(monochrome)
    .resize(size, size)
    .png()
    .toFile(
      fileURLToPath(
        new URL(
          `../public/icons/book-monochrome-v3-${size}.png`,
          import.meta.url,
        ),
      ),
    );
}
