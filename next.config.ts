import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploaded photos are resized + re-encoded to webp client-side (~150-400 KB),
    // then sent base64 to a Server Action. Give comfortable headroom over the 1 MB default.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
