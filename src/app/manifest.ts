import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sharable",
    short_name: "Sharable",
    description: "Share everything with Sharable",
    start_url: "/",
    display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        {
          src: "/icon",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/apple-icon",
          sizes: "180x180",
          type: "image/png",
        },
      ],
  };
}
