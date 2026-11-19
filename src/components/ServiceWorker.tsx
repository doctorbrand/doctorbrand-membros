"use client";

import { useEffect } from "react";

/** Registra o service worker (notificações). Só onde o navegador suporta; não atrapalha quem não suporta. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}
