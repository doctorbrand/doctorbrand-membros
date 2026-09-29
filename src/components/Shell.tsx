import Link from "next/link";
import type { Session } from "@/lib/auth";
import { todayISO, fmtDate } from "@/lib/periods";

export function Shell({ children, active, session, clientSlug }: { children: React.ReactNode; active: "geral" | "conteudo" | "admin"; session?: Session | null; clientSlug?: string }) {
  const isClient = session?.role === "cliente";
  const slug = clientSlug ?? (isClient ? session?.clientSlug : undefined);
  const nav = (href: string, label: string, key: string) => (
    <Link href={href} className={`px-2.5 sm:px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${active === key ? "bg-[var(--ink)] text-white" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>{label}</Link>
  );
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 min-h-14 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Link href={isClient && session?.clientSlug ? `/cliente/${session.clientSlug}/conteudo` : "/conteudo"} className="font-semibold tracking-tight whitespace-nowrap">
            DoctorBrand <span className="text-[var(--muted)] font-normal hidden sm:inline">· Área de membros</span>
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1 text-sm -mx-1 overflow-x-auto max-w-full">
            {!isClient && nav("/conteudo", "Clientes", "geral")}
            {slug && nav(`/cliente/${slug}/conteudo`, "Conteúdo", "conteudo")}
            {session?.role === "admin" && nav("/admin/usuarios", "Acessos", "admin")}
            {session && <span className="hidden md:inline text-xs text-[var(--muted)] px-2">{session.name}</span>}
            <form action="/api/logout" method="post"><button className="px-2.5 sm:px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] whitespace-nowrap">Sair</button></form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-[var(--muted)]">
        Planejamento de conteúdo DoctorBrand. Nada é publicado sem aprovação registrada. Hoje: {fmtDate(todayISO())} (horário de Brasília).
      </footer>
    </div>
  );
}
