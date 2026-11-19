import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // O service worker nunca fica em cache: cada versão nova chega na hora a todos os aparelhos.
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] }];
  },
};

export default nextConfig;
