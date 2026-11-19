import type { MetadataRoute } from "next";

/** Deixa a área instalável como app (tela de início do iPhone e do Android) e habilita as notificações. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DoctorBrand · Área de membros",
    short_name: "DoctorBrand",
    description: "Seu conteúdo, aprovado antes de ir ao ar.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
