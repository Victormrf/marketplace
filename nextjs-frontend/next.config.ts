import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_E2E === "1" ? ".next-e2e" : ".next",
  /* config options here */
  images: {
    domains: ["res.cloudinary.com"],
  },
};

export default nextConfig;
