import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionButton } from "@/components/content/ContentActions";
import { Shell } from "@/components/Shell";
import { CheckIcon, EyeIcon } from "@/components/Icons";
import { requireAuth } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { dataCurta } from "@/lib/contrato";
import { acessosDoPlano, BRIEFING, getOnboarding, progresso } from "@/lib/onboarding";
import { planKey } from "@/lib/plans";
import { getProject } from "@/lib/project";
import { aplicarBriefingAction, confirmarAcessoAction, desfazerAcessoAction, marcarAcessoAction, salvarBriefingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ visao?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  const asClient = session.role === "admin" && sp.visao === "cliente";
  const admin = session.role === "admin" && !asClient;
  const c = await getClient(slug);
  if (!c) notFound();
  const [project, d] = await Promise.all([getProject(slug), getOnboarding(slug)]);
  const k = planKey(project.plano);
  const itens = acessosDoPlano(k === "growth" || k === "black");
  const pr = progresso(d, itens);
  const b = d.briefing;

  return (
    <Shell active="onboarding" session={session} clientSlug={slug}>
      {asClient && (
        <div className="card p-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ background: "#fff7e0" }}>
          <span><b>Você está vendo como {c.name} vê.</b></span>
          <Link href={`/cliente/${slug}/onboarding`} className="ct-btn">Voltar à visão da equipe</Link>
        </div>
      )}
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Onboarding</p>
          <h1 className="mt-1.5">{pr.completo ? <>Tudo pronto. <i>Obrigado!</i></> : <>Vamos começar. <i>Leva uns 20 minutos.</i></>}</h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">Os acessos que a equipe precisa e o briefing sobre você e sua clínica. Nenhuma senha é pedida aqui: tudo é feito por convite, e você pode parar e continuar depois.</p>
        </div>
        <div className="ct-hero-actions">
          {admin && <a href={`/api/preview?slug=${slug}&volta=${encodeURIComponent(`/cliente/${slug}/onboarding`)}`} className="ct-btn inline-flex items-center gap-1.5"><EyeIcon /> Ver como o cliente</a>}
        </div>
      </section>

      <section className="card p-5 mb-4">
        <div className="flex items-center justify-between gap-3"><span className="font-medium">{pr.pct}% concluído</span><span className="text-[13px] text-[var(--muted)]">{pr.feitos} de {pr.total} acessos · briefing {pr.briefing ? "enviado" : "pendente"}</span></div>
        <div className="ct-progress mt-2"><span style={{ width: `${pr.pct}%`, background: "var(--good)" }} /></div>
      </section>

      <div className="pj-grid">
        <section className="card p-5">
          <h2 className="pj-h2">Acessos</h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">Faça cada item e toque em Feito. A equipe confere e confirma.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {itens.map((a) => {
              const m = d.acessos[a.id];
              return (
                <li key={a.id} className={`ob-item ${m ? `is-${m.status}` : ""}`}>
                  <details open={!m}>
                    <summary className="ob-sum">
                      <span className={`ob-dot ${m ? `is-${m.status}` : ""}`}>{m && <CheckIcon size={12} />}</span>
                      <span className="min-w-0 flex-1"><span className="block font-medium">{a.titulo}</span><span className="block text-[12.5px] text-[var(--muted)]">{m ? (m.status === "confirmado" ? "Confirmado pela equipe" : "Feito, aguardando a equipe confirmar") : a.texto}</span></span>
                    </summary>
                    <ol className="ob-steps">{a.passos.map((p) => <li key={p}>{p}</li>)}</ol>
                    {m?.nota && <p className="text-[13px] mt-2"><span className="text-[var(--muted)]">Nota:</span> {m.nota}</p>}
                    <div className="flex flex-wrap items-start gap-2 mt-3">
                      {(!m || admin) && m?.status !== "confirmado" && (
                        <ActionForm action={marcarAcessoAction.bind(null, slug, a.id)} className="flex flex-wrap gap-2 flex-1 min-w-[240px]">
                          <input name="nota" placeholder={a.id === "agendamento" ? "Número ou link de agendamento" : "Nota para a equipe (opcional, sem senhas)"} className="ct-input flex-1 min-w-[180px]" required={a.id === "agendamento"} />
                          <button className="ct-btn ct-btn-dark">{admin ? "Confirmar" : "Feito"}</button>
                        </ActionForm>
                      )}
                      {admin && m?.status === "feito" && <ActionButton action={confirmarAcessoAction.bind(null, slug, a.id)} label="Confirmar" variant="dark" />}
                      {m && (admin || m.status === "feito") && <ActionButton action={desfazerAcessoAction.bind(null, slug, a.id)} label="Desfazer" variant="ghost" />}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pj-h2">Briefing</h2>
            {b?.enviadoEm && <span className="ev-tag">Enviado em {dataCurta(b.enviadoEm.slice(0, 10))}</span>}
          </div>
          <p className="text-[13px] text-[var(--muted)] mt-1">Responda do seu jeito, como falaria numa conversa. É a base de todo o conteúdo que criamos para você.</p>
          <ActionForm action={salvarBriefingAction.bind(null, slug)} className="flex flex-col gap-4 mt-4">
            {BRIEFING.map((q) => (
              <label key={q.key} className="flex flex-col gap-1">
                <span className="font-medium text-[14.5px]">{q.pergunta}</span>
                {q.dica && <span className="text-[12.5px] text-[var(--muted)]">{q.dica}</span>}
                {q.rows > 1 ? <textarea name={q.key} rows={q.rows} defaultValue={b?.respostas[q.key]} className="ct-input" /> : <input name={q.key} defaultValue={b?.respostas[q.key]} className="ct-input" />}
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <button name="intent" value="enviar" className="ct-btn ct-btn-dark">{b?.enviadoEm ? "Atualizar e reenviar" : "Enviar briefing"}</button>
              <button name="intent" value="rascunho" className="ct-btn">Salvar e continuar depois</button>
            </div>
          </ActionForm>
          {admin && b?.enviadoEm && (
            <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-col gap-2">
              <p className="text-[13px] text-[var(--muted)]">{b.aplicadoEm ? `Levado para o Perfil em ${dataCurta(b.aplicadoEm.slice(0, 10))}.` : "As respostas ainda não foram levadas para o Perfil."} Só os campos vazios do Perfil são preenchidos.</p>
              <div className="flex gap-2"><ActionButton action={aplicarBriefingAction.bind(null, slug)} label="Levar para o Perfil" variant="dark" /><Link href={`/cliente/${slug}/perfil`} className="ct-btn">Abrir Perfil</Link></div>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
