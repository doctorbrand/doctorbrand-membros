import Link from "next/link";
import { Shell } from "@/components/Shell";
import { ActionButton } from "@/components/content/ContentActions";
import { CopyButton } from "@/components/avisos/CopyButton";
import { ArrowUpRightIcon, ChatIcon, CheckIcon } from "@/components/Icons";
import { requireAdmin } from "@/lib/auth";
import { AVISO_LABEL, buildAvisos, getSent, waLink, type Aviso } from "@/lib/avisos";
import { markSentAction, undoSentAction } from "./actions";
import { listClients } from "@/lib/clients";
import { getNps, npsScore, ultima } from "@/lib/nps";

export const dynamic = "force-dynamic";

const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function AvisosPage() {
  const session = await requireAdmin();
  const [avisos, sent, clients] = await Promise.all([buildAvisos(), getSent(), listClients()]);
  const lastScores = (await Promise.all(clients.map((c) => getNps(c.slug).then((d) => ultima(d)?.score)))).filter((x): x is number => x !== undefined);
  const nps = npsScore(lastScores);
  const pending = avisos.filter((a) => !sent[a.key]);
  const done = avisos.filter((a) => sent[a.key]);
  const toClient = pending.filter((a) => a.message);
  const internal = pending.filter((a) => !a.message);

  return (
    <Shell active="avisos" session={session}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Avisos para os clientes</p>
          <h1 className="mt-1.5">{toClient.length ? <>{toClient.length} {toClient.length === 1 ? "mensagem" : "mensagens"} para enviar. <i>Tudo pronto.</i></> : <>Nada pendente. <i>Tudo em dia.</i></>}</h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">O sistema junta o que cada cliente precisa saber e deixa a mensagem escrita. Revise, envie pelo WhatsApp e marque como enviado.</p>
        </div>
        <div className="card av-nps">
          <span className="label">NPS da carteira</span>
          <b>{nps ?? "–"}</b>
          <span className="text-[12.5px] text-[var(--muted)]">{lastScores.length ? `${lastScores.length} ${lastScores.length === 1 ? "cliente respondeu" : "clientes responderam"}` : "Ainda sem respostas"}</span>
        </div>
      </section>

      <div className="av-list">
        {toClient.map((a) => <AvisoCard key={a.key} a={a} />)}
      </div>

      {internal.length > 0 && (
        <section className="mt-6">
          <p className="label mb-2">Para a equipe</p>
          <div className="av-list">{internal.map((a) => <AvisoCard key={a.key} a={a} />)}</div>
        </section>
      )}

      {done.length > 0 && (
        <details className="pj-edit mt-6">
          <summary className="pj-edit-toggle">Enviados ({done.length})</summary>
          <ul className="card mt-3 px-5">
            {done.map((a) => (
              <li key={a.key} className="pj-step items-center">
                <span className="pj-step-ic s-concluida"><CheckIcon size={12} /></span>
                <span className="min-w-0 flex-1"><span className="block">{a.client.name} · {a.title}</span><span className="block text-[12.5px] text-[var(--muted)]">{sent[a.key].by}, {hora(sent[a.key].at)}</span></span>
                <ActionButton action={undoSentAction.bind(null, a.key)} label="Desfazer" variant="ghost" />
              </li>
            ))}
          </ul>
        </details>
      )}
    </Shell>
  );
}

function AvisoCard({ a }: { a: Aviso }) {
  return (
    <article className={`card av-card ${a.urgent ? "is-urgent" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{AVISO_LABEL[a.kind]}{a.urgent ? " · hoje" : ""}</p>
          <h2 className="pj-h2 mt-1">{a.client.name}</h2>
          <p className="text-[14.5px] mt-0.5">{a.title}</p>
          <p className="text-[13px] text-[var(--muted)]">{a.detail}</p>
        </div>
        <Link href={a.kind === "circle" ? "/admin/indicacoes" : a.kind === "onboarding" ? `/cliente/${a.client.slug}/onboarding` : a.kind === "contrato" || a.kind === "nps" ? `/cliente/${a.client.slug}` : a.kind === "aprovar" || a.kind === "ajuste" ? `/cliente/${a.client.slug}/conteudo` : a.kind === "relatorio" ? `/relatorio/${a.client.slug}/${a.key.split(":").at(-1)}` : `/cliente/${a.client.slug}`} className="pj-more flex-none">Abrir <ArrowUpRightIcon size={14} /></Link>
      </div>
      {a.message && <p className="av-msg">{a.message}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {a.message && <a href={waLink(a.message, a.phone)} target="_blank" rel="noreferrer" className="ct-btn ct-btn-dark inline-flex items-center gap-1.5"><ChatIcon size={16} /> {a.phone ? "Enviar no WhatsApp" : "Escolher contato no WhatsApp"}</a>}
        {a.message && <CopyButton text={a.message} />}
        <ActionButton action={markSentAction.bind(null, a.key)} label={a.message ? "Marcar como enviado" : "Resolvido"} variant="ghost" />
      </div>
      {a.message && !a.phone && <p className="text-[12px] text-[var(--muted)] mt-2">Sem WhatsApp do cliente cadastrado. Preencha em Projeto, Plano e contato, para abrir direto na conversa dele.</p>}
    </article>
  );
}
