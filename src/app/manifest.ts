import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Winkle Study",
    short_name: "Winkle Study",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [192, 512].flatMap((size) =>
      (["any", "maskable", "monochrome"] as const).map((purpose) => ({
        src:
          purpose === "monochrome"
            ? `/icons/book-monochrome-v3-${size}.png`
            : `/icons/home-dark-v2-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose,
      })),
    ),
  };
}
