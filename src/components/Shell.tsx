import { cookies } from "next/headers";
import type { Session } from "@/lib/auth";
import { Sidebar, type NavItem, type NavSection } from "@/components/Sidebar";
import { ADS_CLIENTS } from "@/lib/ads";
import { getClient } from "@/lib/clients";
import { acessosDoPlano, getOnboarding, progresso } from "@/lib/onboarding";
import { todayISO, fmtDate } from "@/lib/periods";
import { planKey } from "@/lib/plans";
import { getProject, onboardingAtivo } from "@/lib/project";
import { igProfile } from "@/lib/instagram";
import { pushLigado } from "@/lib/push";
import { areaDoCliente, radarLigado } from "@/lib/radar";

/** Radar da Cirurgia Plástica: notícias do mercado para pauta. Só a equipe vê no menu e entra sem código (rota /radar). */
const RADAR_URL = "/radar";

export type ShellActive =
  | "geral" | "projeto" | "evolucao" | "conteudo" | "calendario" | "anuncios" | "semana" | "ajuda" | "perfil" | "marca" | "gerar"
  | "avisos" | "onboarding" | "indicacoes" | "circle" | "admin" | "config" | "acessos" | "notificacoes" | "cofre" | "radar";

export async function Shell({ children, active, session, clientSlug }: { children: React.ReactNode; active: ShellActive; session?: Session | null; clientSlug?: string }) {
  const isClient = session?.role === "cliente";
  const admin = session?.role === "admin";
  const slug = clientSlug ?? (isClient ? session?.clientSlug : undefined);
  const jar = await cookies();
  const collapsed = jar.get("db_sb")?.value === "1";

  const it = (href: string, label: string, icon: NavItem["icon"], key: ShellActive): NavItem => ({ href, label, icon, active: active === key });
  const sections: NavSection[] = [];
  let client: { name: string; sub?: string; switchHref?: string; photo?: string } | undefined;

  if (slug) {
    const c = await getClient(slug).catch(() => undefined);
    // Onboarding só para quem está entrando, e o cliente só vê enquanto não estiver completo.
    // Cliente da casa: vira "Acessos e briefing", registro interno que só a equipe vê.
    const [p, d] = await Promise.all([getProject(slug), getOnboarding(slug)]).catch(() => [null, null] as const);
    const ativo = !!p && onboardingAtivo(p);
    let showOnb = admin && ativo;
    if (isClient && p && d && ativo) { const k = planKey(p.plano); showOnb = !progresso(d, acessosDoPlano(k === "growth" || k === "black")).completo; }
    // Foto do Instagram ligado (cache de 1h); cliente novo com Instagram ligado já aparece com a foto.
    const photo = c?.igUserId ? (await igProfile(c.igUserId).catch(() => null))?.picture : undefined;
    if (c) client = { name: c.name, sub: isClient ? "Área de membros" : c.specialty, switchHref: admin ? "/conteudo" : undefined, photo };
    const b = `/cliente/${slug}`;
    sections.push({
      title: admin ? "Cliente" : undefined,
      items: [
        it(b, "Projeto", "home", "projeto"),
        it(`${b}/evolucao`, "Evolução", "trend", "evolucao"),
        it(`${b}/conteudo`, "Conteúdo", "grid", "conteudo"),
        it(`${b}/calendario`, "Calendário", "calendar", "calendario"),
        ...(c && radarLigado() && areaDoCliente(c) ? [it(`${b}/radar`, "Radar", "radar", "radar")] : []),
        ...(ADS_CLIENTS.has(slug) ? [it(`${b}/anuncios`, "Anúncios", "megaphone", "anuncios"), it(`${b}/semana`, "Sua semana", "calendar", "semana")] : []),
        ...(showOnb ? [it(`${b}/onboarding`, "Onboarding", "checklist", "onboarding")] : []),
        it(`${b}/indicacoes`, "Indicações", "spark", "indicacoes"),
      ],
    });
    if (admin) sections.push({ title: "Só a equipe", items: [it(`${b}/acessos`, "Acessos", "key", "cofre"), it(`${b}/perfil`, "Perfil", "user", "perfil"), it(`${b}/marca`, "Kit de marca", "palette", "marca"), ...(!ativo ? [it(`${b}/onboarding`, "Briefing", "checklist", "onboarding")] : []), it(`${b}/gerar`, "Gerar", "wand", "gerar"), { href: `/api/preview?slug=${slug}`, label: "Ver como o cliente", icon: "eye", active: false }] });
  }
  if (admin) {
    sections.unshift({ title: "Equipe", items: [it("/conteudo", "Clientes", "users", "geral"), it("/admin/avisos", "Avisos", "bell", "avisos"), it("/admin/indicacoes", "Circle", "spark", "circle"), it("/admin/usuarios", "Usuários", "users", "acessos"), { href: RADAR_URL, label: "Radar", icon: "radar", active: false, external: true }] });
  }

  const footer: NavItem[] = [
    ...(pushLigado() ? [it("/notificacoes", "Notificações", "bell", "notificacoes")] : []),
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
