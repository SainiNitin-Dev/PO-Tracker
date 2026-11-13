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
        src: "/progressive-logo.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
