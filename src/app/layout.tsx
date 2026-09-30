import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "DoctorBrand · Área de membros",
  description: "Planejamento, aprovação e agendamento do conteúdo dos clientes DoctorBrand.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#1E1B14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
