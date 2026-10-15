import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fonte Inter usada na montagem dos slides de carrossel (lida do disco pelo servidor).
  outputFileTracingIncludes: { "/**": ["./src/assets/fonts/**/*"] },
};

export default nextConfig;
