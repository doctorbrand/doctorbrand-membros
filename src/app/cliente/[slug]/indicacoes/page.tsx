import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Shell } from "@/components/Shell";
import { CheckIcon, LockIcon, SparkIcon } from "@/components/Icons";
import { requireAuth } from "@/lib/auth";
import { getCircle, LIMITE_ATIVAS, nivelDe, NIVEIS, STATUS_LABEL } from "@/lib/circle";
import { getClient } from "@/lib/clients";
import { dataCurta } from "@/lib/contrato";
import { indicarAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function IndicacoesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ visao?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  const asClient = session.role === "admin" && sp.visao === "cliente";
  const admin = session.role === "admin" && !asClient;
  const c = await getClient(slug);
  if (!c) notFound();
  const d = await getCircle();
  const minhas = d.indicacoes.filter((i) => i.slug === slug).sort((a, b) => b.at.localeCompare(a.at));
  const nivel = nivelDe(d.indicacoes, slug);
  const entregues = new Set(d.entregues[slug] ?? []);
  const ativas = minhas.filter((i) => i.status !== "nao").length;

  return (
    <Shell active="indicacoes" session={session} clientSlug={slug}>
      {asClient && (
        <div className="card p-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ background: "#fff7e0" }}>
          <span><b>Você está vendo como {c.name} vê.</b></span>
          <Link href={`/cliente/${slug}/indicacoes`} className="ct-btn">Voltar à visão da equipe</Link>
        </div>
      )}
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Circle DoctorBrand</p>
          <h1 className="mt-1.5">Indique um colega. <i>Suba de nível.</i></h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">Indique médicos com quem você tem afinidade real. Quando a indicação vira cliente, você conquista o próximo nível. Não é dinheiro: é acesso, status e proximidade estratégica.</p>
        </div>
        {admin && <div className="ct-hero-actions"><Link href="/admin/indicacoes" className="ct-btn">Todas as indicações</Link><Link href={`/cliente/${slug}/indicacoes?visao=cliente`} className="ct-btn">Ver como o cliente</Link></div>}
      </section>

      <div className="pj-grid">
        <div className="flex flex-col gap-4 min-w-0">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="pj-h2">Seus níveis</h2>
              <span className="text-[13px] text-[var(--muted)]">{nivel === 0 ? "Nenhuma indicação fechada ainda" : `${nivel} ${nivel === 1 ? "indicação virou cliente" : "indicações viraram clientes"}`}</span>
            </div>
            <ol className="flex flex-col gap-2 mt-3">
              {NIVEIS.map((n) => {
                const on = nivel >= n.n;
                return (
                  <li key={n.n} className={`ev-badge ${on ? "is-on" : ""}`}>
                    <span className="ev-badge-ic">{on ? <CheckIcon size={14} /> : n.emBreve ? <SparkIcon size={16} /> : <LockIcon />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-[14px]">Nível {n.n} · {n.titulo}</span>
                      <span className="block text-[12.5px] text-[var(--muted)]">{n.texto}</span>
                    </span>
                    <span className="text-[12px] text-[var(--muted)] flex-none">{on ? (n.emBreve ? "Garantido" : entregues.has(n.n) ? "Entregue" : "Conquistado") : `${n.n} ${n.n === 1 ? "indicação" : "indicações"}`}</span>
                  </li>
                );
              })}
            </ol>
            <p className="text-[12.5px] text-[var(--muted)] mt-3">Conta a indicação que fecha contrato. Até {LIMITE_ATIVAS} indicações por cliente.</p>
          </section>

          {minhas.length > 0 && (
            <section className="card p-5">
              <h2 className="pj-h2">Suas indicações</h2>
              <ul className="mt-2 flex flex-col">
                {minhas.map((i) => (
                  <li key={i.id} className="pj-step">
                    <span className={`pj-step-ic ${i.status === "fechou" ? "s-concluida" : i.status === "nao" ? "s-nao_iniciada" : "s-andamento"}`}>{i.status === "fechou" && <CheckIcon size={12} />}</span>
                    <span className="min-w-0 flex-1"><span className="block font-medium">{i.nome}</span><span className="block text-[12.5px] text-[var(--muted)]">{[i.especialidade, i.cidade].filter(Boolean).join(" · ") || "Indicado"} · {dataCurta(i.at.slice(0, 10))}</span></span>
                    <span className="ev-tag">{STATUS_LABEL[i.status]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="card p-5">
          <h2 className="pj-h2">Nova indicação</h2>
          {ativas >= LIMITE_ATIVAS ? <p className="text-sm text-[var(--muted)] mt-2">Você chegou ao limite de {LIMITE_ATIVAS} indicações. Obrigado!</p> : (
            <ActionForm action={indicarAction.bind(null, slug)} className="flex flex-col gap-2 mt-3">
              <input name="nome" placeholder="Nome do colega" className="ct-input" required />
              <input name="especialidade" placeholder="Especialidade" className="ct-input" />
              <input name="contato" placeholder="WhatsApp ou @ do Instagram" className="ct-input" required />
              <input name="cidade" placeholder="Cidade" className="ct-input" />
              <textarea name="obs" rows={3} placeholder="Algo que ajude na conversa (opcional)" className="ct-input" />
              <label className="flex items-start gap-2 text-[13.5px]"><input type="checkbox" name="aviso" className="mt-1" /> <span>Avisei o colega que a equipe DoctorBrand vai entrar em contato.</span></label>
              <button className="ct-btn ct-btn-dark self-start">Enviar indicação</button>
            </ActionForm>
          )}
          <p className="text-[12.5px] text-[var(--muted)] mt-3">A equipe fala com o colega em nome de você, com todo o cuidado. Você acompanha cada passo aqui.</p>
        </section>
      </div>
    </Shell>
  );
}
