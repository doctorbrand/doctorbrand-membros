import type { Metadata } from "next";
import "./globals.css";
// STUB LOCAL: restaurar /tmp/claude-0/layout.prod.tsx antes do commit.
export const metadata: Metadata = { title: "DoctorBrand · Área de membros" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="pt-BR" style={{ ["--font-inter" as string]: "system-ui" }}><body>{children}</body></html>);
}
