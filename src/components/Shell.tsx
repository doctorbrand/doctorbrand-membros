import Link from "next/link";
import type { Session } from "@/lib/auth";
import { LogoFull } from "@/components/Logo";
import { ADS_CLIENTS } from "@/lib/ads";
import { todayISO, fmtDate } from "@/lib/periods";

export function Shell({ children, active, session, clientSlug }: { children: React.ReactNode; active: "geral" | "projeto" | "evolucao" | "conteudo" | "anuncios" | "ajuda" | "perfil" | "gerar" | "avisos" | "admin"; session?: Session | null; clientSlug?: string }) {
  const isClient = session?.role === "cliente";
  const slug = clientSlug ?? (isClient ? session?.clientSlug : undefined);
  const nav = (href: string, label: string, key: string) => (
    <Link href={href} className={`px-2.5 sm:px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${active === key ? "bg-[var(--ink)] text-white" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>{label}</Link>
  );
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 min-h-14 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Link href={isClient && session?.clientSlug ? `/cliente/${session.clientSlug}` : "/conteudo"} className="whitespace-nowrap flex items-center" aria-label="DoctorBrand, início">
            <LogoFull className="h-[20px] self-center text-[var(--ink)]" /><span className="text-[var(--muted)] font-normal text-sm hidden sm:inline ml-3 pl-3 border-l border-[var(--line)] leading-4">Área de membros</span>
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1 text-sm -mx-1 overflow-x-auto max-w-full">
            {!isClient && nav("/conteudo", "Clientes", "geral")}
            {slug && nav(`/cliente/${slug}`, "Projeto", "projeto")}
            {slug && nav(`/cliente/${slug}/evolucao`, "Evolução", "evolucao")}
            {slug && nav(`/cliente/${slug}/conteudo`, "Conteúdo", "conteudo")}
            {slug && ADS_CLIENTS.has(slug) && nav(`/cliente/${slug}/anuncios`, "Anúncios", "anuncios")}
            {nav(slug && !isClient ? `/ajuda?c=${slug}` : "/ajuda", "Ajuda", "ajuda")}
            {slug && session?.role === "admin" && nav(`/cliente/${slug}/perfil`, "Perfil", "perfil")}
            {slug && session?.role === "admin" && nav(`/cliente/${slug}/gerar`, "Gerar", "gerar")}
            {session?.role === "admin" && nav("/admin/avisos", "Avisos", "avisos")}
            {session?.role === "admin" && nav("/admin/usuarios", "Acessos", "admin")}
            {session && <span className={`${isClient ? "inline" : "hidden md:inline"} text-xs text-[var(--muted)] px-2 truncate max-w-[40vw]`}>{session.name}</span>}
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
