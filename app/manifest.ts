import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Progressive",
    short_name: "Progressive",
    description: "Your private strength log and training companion",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f2eb",
    theme_color: "#f5f2eb",
    icons: [
      {
        src: "/progressive-olive-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/progressive-olive-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
