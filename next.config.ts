import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile elsewhere on the
  // machine would otherwise make Next infer the wrong root).
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Uploaded photos are resized + re-encoded to webp client-side (~150-400 KB),
    // then sent base64 to a Server Action. Give comfortable headroom over the 1 MB default.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
