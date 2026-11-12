import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Progressive Overload Tracker", short_name: "Progressive", description: "Private, data-led strength training", start_url: "/", display: "standalone", background_color: "#09090b", theme_color: "#a3e635" }; }
