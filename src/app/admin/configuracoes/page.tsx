import Link from "next/link";
import { Shell } from "@/components/Shell";
import { CheckIcon } from "@/components/Icons";
import { requireAdmin } from "@/lib/auth";
import { TEAM_WHATSAPP } from "@/lib/project";

export const dynamic = "force-dynamic";

const on = (...k: string[]) => k.some((x) => !!process.env[x]);

/** Integrações da área de membros: o que está ligado e o que falta, sem mostrar nenhum valor. */
export default async function ConfiguracoesPage() {
  const session = await requireAdmin();
  const grupos: { titulo: string; itens: { nome: string; faz: string; ok: boolean; como: string; opcional?: boolean }[] }[] = [
    { titulo: "Base", itens: [
      { nome: "Armazenamento", faz: "Guarda clientes, posts, acessos e tudo o que é salvo.", ok: on("BLOB_READ_WRITE_TOKEN"), como: "Vercel, Storage, Blob ligado ao projeto." },
      { nome: "Senha mestre", faz: "Acesso da equipe sem usuário próprio.", ok: on("PANEL_PASSWORD"), como: "PANEL_PASSWORD" },
    ] },
    { titulo: "Conteúdo e Instagram", itens: [
      { nome: "Meta (Instagram)", faz: "Publica os posts aprovados e lê o feed.", ok: on("META_ACCESS_TOKEN"), como: "META_ACCESS_TOKEN" },
      { nome: "Publicação automática", faz: "Publica na hora marcada e manda o resumo diário de avisos.", ok: on("CRON_SECRET"), como: "CRON_SECRET + agendamento no cron-job.org" },
      { nome: "Apify", faz: "Lê perfis do Instagram sem conta ligada (diagnóstico).", ok: on("APIFY_TOKEN"), como: "APIFY_TOKEN", opcional: true },
      { nome: "Google Drive", faz: "Importa mídias de pastas do Drive.", ok: on("GOOGLE_API_KEY"), como: "GOOGLE_API_KEY", opcional: true },
    ] },
    { titulo: "Projeto do cliente", itens: [
      { nome: "ClickUp", faz: "Entregas, Evolução, em produção agora, desde quando é cliente.", ok: on("CLICKUP_API_TOKEN"), como: "CLICKUP_API_TOKEN (ClickUp, Settings, Apps)" },
      { nome: "Google Agenda", faz: "Reuniões, captações e lembretes de cada cliente.", ok: on("GOOGLE_CALENDAR_ICS"), como: "GOOGLE_CALENDAR_ICS (endereço secreto iCal)" },
      { nome: "Painel de anúncios", faz: "Números de anúncios na aba Anúncios e no relatório.", ok: on("MEMBROS_API_KEY"), como: "MEMBROS_API_KEY (mesmo valor no painel)" },
      { nome: "ZapSign", faz: "Status e arquivo dos contratos.", ok: on("ZAPSIGN_API_TOKEN"), como: "ZAPSIGN_API_TOKEN (ZapSign, Configurações, Integrações)" },
      { nome: "ID de parceiro Meta", faz: "Aparece no passo a passo do onboarding.", ok: on("META_PARTNER_ID"), como: "META_PARTNER_ID", opcional: true },
    ] },
    { titulo: "Avisos para a equipe", itens: [
      { nome: "Canal de alertas", faz: "Aprovações, ajustes, termômetro, indicações e resumo diário.", ok: on("TELEGRAM_BOT_TOKEN", "WHATSAPP_PHONE_ID", "TWILIO_ACCOUNT_SID"), como: "TELEGRAM_BOT_TOKEN (ou WhatsApp Cloud / Twilio)" },
    ] },
  ];
  const total = grupos.flatMap((g) => g.itens).filter((i) => !i.opcional);
  const ligados = total.filter((i) => i.ok).length;

  return (
    <Shell active="config" session={session}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Configurações</p>
          <h1 className="mt-1.5">{ligados} de {total.length} integrações ligadas.</h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">Os valores ficam guardados no Vercel, em Settings, Environment Variables, e nunca aparecem aqui. Depois de salvar uma variável, faça um novo deploy.</p>
        </div>
      </section>

      <div className="cf-grid">
        {grupos.map((g) => (
          <section key={g.titulo} className="card p-5">
            <h2 className="pj-h2">{g.titulo}</h2>
            <ul className="mt-2 flex flex-col">
              {g.itens.map((i) => (
                <li key={i.nome} className="pj-step">
                  <span className={`cf-dot ${i.ok ? "is-on" : i.opcional ? "is-opt" : ""}`}>{i.ok && <CheckIcon size={11} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{i.nome}{i.opcional ? <span className="text-[12px] font-normal text-[var(--muted)]"> · opcional</span> : null}</span>
                    <span className="block text-[13px] text-[var(--muted)]">{i.faz}</span>
                    {!i.ok && <span className="block text-[12.5px] mt-0.5"><code className="mono">{i.como}</code></span>}
                  </span>
                  <span className={`text-[12.5px] font-medium flex-none ${i.ok ? "g-good" : "text-[var(--muted)]"}`}>{i.ok ? "Ligado" : "Desligado"}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="card p-5">
          <h2 className="pj-h2">Equipe e contato</h2>
          <ul className="mt-2 flex flex-col">
            <li className="pj-step"><span className="min-w-0 flex-1"><span className="block font-medium">WhatsApp da equipe</span><span className="block text-[13px] text-[var(--muted)]">Padrão de todos os clientes. Cada projeto pode ter outro em Plano e contato.</span></span><span className="mono text-[13px]">+{TEAM_WHATSAPP}</span></li>
            <li className="pj-step"><span className="min-w-0 flex-1"><span className="block font-medium">Acessos</span><span className="block text-[13px] text-[var(--muted)]">Logins da equipe e dos clientes.</span></span><Link href="/admin/usuarios" className="pj-more">Abrir</Link></li>
            <li className="pj-step"><span className="min-w-0 flex-1"><span className="block font-medium">Avisos e resumo diário</span><span className="block text-[13px] text-[var(--muted)]">O resumo vai às 9h pelo canal de alertas: GET /api/cron/avisos?key=CRON_SECRET no cron-job.org.</span></span><Link href="/admin/avisos" className="pj-more">Abrir</Link></li>
          </ul>
        </section>
      </div>
    </Shell>
  );
}
