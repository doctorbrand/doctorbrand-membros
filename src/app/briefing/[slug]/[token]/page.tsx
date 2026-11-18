import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { LogoFull } from "@/components/Logo";
import { getClient } from "@/lib/clients";
import { dataCurta } from "@/lib/contrato";
import { BRIEFING, getOnboarding, tokenBriefingOk } from "@/lib/onboarding";
import { briefingPorLinkAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Briefing · DoctorBrand", robots: { index: false, follow: false } };

/** Dia em Brasília de um horário salvo em UTC. */
const diaBR = (iso: string) => new Date(Date.parse(iso) - 3 * 3600e3).toISOString().slice(0, 10);

/** Briefing que o cliente preenche pelo link do WhatsApp, sem login. Salva no Onboarding dele. */
export default async function BriefingPorLink({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const valido = /^[a-z0-9-]{1,80}$/.test(slug);
  const [c, d] = valido ? await Promise.all([getClient(slug), getOnboarding(slug)]) : [undefined, undefined];
  const ok = !!c && !c.removed && !!d && tokenBriefingOk(d, token);

  return (
    <div className="rp">
      <header className="rp-bar">
        <div className="rp-wrap bf-wrap"><LogoFull className="h-[18px] text-[var(--ink)]" /></div>
      </header>
      <main className="rp-wrap bf-wrap pb-16">
        {!ok ? (
          <section className="rp-cover">
            <p className="label">Briefing</p>
            <h1 className="bf-title">Este link não está mais ativo.</h1>
            <p className="text-[15px] text-[var(--muted)] mt-3">Peça um novo para a equipe DoctorBrand pelo WhatsApp.</p>
          </section>
        ) : (
          <>
            <section className="rp-cover">
              <p className="label">Briefing · {c!.name}</p>
              <h1 className="bf-title">Conte para a gente sobre você e sua clínica.</h1>
              <p className="text-[15px] text-[var(--muted)] mt-3">Responda do seu jeito, como falaria numa conversa. É a base de todo o conteúdo que criamos para você. Leva uns 15 minutos, e dá para salvar e continuar depois por este mesmo link.</p>
              {d!.briefing?.enviadoEm && <p className="ev-tag inline-block mt-4">Enviado em {dataCurta(diaBR(d!.briefing.enviadoEm))}. Você ainda pode ajustar e reenviar.</p>}
            </section>
            <section className="card p-5 sm:p-6">
              <ActionForm action={briefingPorLinkAction.bind(null, slug, token)} className="flex flex-col gap-5">
                {BRIEFING.map((q, i) => (
                  <label key={q.key} className="flex flex-col gap-1">
                    <span className="font-medium text-[15px]"><span className="text-[var(--muted)] tabular-nums">{i + 1}.</span> {q.pergunta}</span>
                    {q.dica && <span className="text-[13px] text-[var(--muted)]">{q.dica}</span>}
                    {q.rows > 1
                      ? <textarea name={q.key} rows={q.rows} defaultValue={d!.briefing?.respostas[q.key]} className="ct-input bf-input" />
                      : <input name={q.key} defaultValue={d!.briefing?.respostas[q.key]} className="ct-input bf-input" />}
                  </label>
                ))}
                <p className="text-[13px] text-[var(--muted)]">Não escreva senhas aqui. Os acessos são feitos por convite, com a equipe.</p>
                <div className="flex flex-wrap gap-2">
                  <button name="intent" value="enviar" className="ct-btn ct-btn-dark ct-btn-lg">{d!.briefing?.enviadoEm ? "Atualizar e reenviar" : "Enviar briefing"}</button>
                  <button name="intent" value="rascunho" className="ct-btn ct-btn-lg">Salvar e continuar depois</button>
                </div>
              </ActionForm>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
