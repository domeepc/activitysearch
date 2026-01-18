import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
    unoptimized: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "payment=(self \"https://js.stripe.com\" \"https://m.stripe.network\")",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
