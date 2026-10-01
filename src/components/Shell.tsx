import { cookies } from "next/headers";
import type { Session } from "@/lib/auth";
import { Sidebar, type NavItem, type NavSection } from "@/components/Sidebar";
import { ADS_CLIENTS } from "@/lib/ads";
import { getClient } from "@/lib/clients";
import { acessosDoPlano, getOnboarding, progresso } from "@/lib/onboarding";
import { todayISO, fmtDate } from "@/lib/periods";
import { planKey } from "@/lib/plans";
import { getProject } from "@/lib/project";

export type ShellActive =
  | "geral" | "projeto" | "evolucao" | "conteudo" | "anuncios" | "ajuda" | "perfil" | "gerar"
  | "avisos" | "onboarding" | "indicacoes" | "circle" | "admin" | "config";

export async function Shell({ children, active, session, clientSlug }: { children: React.ReactNode; active: ShellActive; session?: Session | null; clientSlug?: string }) {
  const isClient = session?.role === "cliente";
  const admin = session?.role === "admin";
  const slug = clientSlug ?? (isClient ? session?.clientSlug : undefined);
  const jar = await cookies();
  const collapsed = jar.get("db_sb")?.value === "1";

  const it = (href: string, label: string, icon: NavItem["icon"], key: ShellActive): NavItem => ({ href, label, icon, active: active === key });
  const sections: NavSection[] = [];
  let client: { name: string; sub?: string; switchHref?: string } | undefined;

  if (slug) {
    const c = await getClient(slug).catch(() => undefined);
    // O cliente só vê o Onboarding enquanto ele não estiver completo; a equipe sempre vê.
    let showOnb = admin;
    if (isClient) {
      const [p, d] = await Promise.all([getProject(slug), getOnboarding(slug)]).catch(() => [null, null] as const);
      if (p && d) { const k = planKey(p.plano); showOnb = !progresso(d, acessosDoPlano(k === "growth" || k === "black")).completo; }
    }
    if (c) client = { name: c.name, sub: isClient ? "Área de membros" : c.specialty, switchHref: admin ? "/conteudo" : undefined };
    const b = `/cliente/${slug}`;
    sections.push({
      title: admin ? "Cliente" : undefined,
      items: [
        it(b, "Projeto", "home", "projeto"),
        it(`${b}/evolucao`, "Evolução", "trend", "evolucao"),
        it(`${b}/conteudo`, "Conteúdo", "grid", "conteudo"),
        ...(ADS_CLIENTS.has(slug) ? [it(`${b}/anuncios`, "Anúncios", "megaphone", "anuncios")] : []),
        ...(showOnb ? [it(`${b}/onboarding`, "Onboarding", "checklist", "onboarding")] : []),
        it(`${b}/indicacoes`, "Indicações", "spark", "indicacoes"),
      ],
    });
    if (admin) sections.push({ title: "Só a equipe", items: [it(`${b}/perfil`, "Perfil", "user", "perfil"), it(`${b}/gerar`, "Gerar", "wand", "gerar"), { href: `/api/preview?slug=${slug}`, label: "Ver como o cliente", icon: "eye", active: false }] });
  }
  if (admin) {
    sections.unshift({ title: "Equipe", items: [it("/conteudo", "Clientes", "users", "geral"), it("/admin/avisos", "Avisos", "bell", "avisos"), it("/admin/indicacoes", "Circle", "spark", "circle")] });
  }

  const footer: NavItem[] = [
    it(slug && admin ? `/ajuda?c=${slug}` : "/ajuda", "Ajuda", "help", "ajuda"),
    ...(admin ? [it("/admin/configuracoes", "Configurações", "gear", active === "admin" ? "admin" : "config")] : []),
  ];
  const home = isClient && session?.clientSlug ? `/cliente/${session.clientSlug}` : "/conteudo";

  return (
    <div className="sb-layout" data-collapsed={collapsed ? "1" : "0"}>
      <Sidebar sections={sections} footer={footer} user={session?.name ?? ""} client={client} home={home} initialCollapsed={collapsed} />
      <div className="sb-main">
        {session?.preview && (
          <div className="pv-bar">
            <span className="min-w-0"><b>Visualização como {session.name}.</b> <span className="pv-sub">É exatamente o que o cliente vê. Nada que você fizer aqui é salvo.</span></span>
            <a href={`/api/preview?off=1&slug=${slug ?? ""}`} className="pv-btn">Sair da visualização</a>
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-xs text-[var(--muted)]">
          Planejamento de conteúdo DoctorBrand. Nada é publicado sem aprovação registrada. Hoje: {fmtDate(todayISO())} (horário de Brasília).
        </footer>
      </div>
    </div>
  );
}
