import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "DoctorBrand · Área de membros",
  description: "Planejamento, aprovação e agendamento do conteúdo dos clientes DoctorBrand.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "DoctorBrand", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#f5f5f7" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}<ServiceWorker /></body>
    </html>
  );
}
