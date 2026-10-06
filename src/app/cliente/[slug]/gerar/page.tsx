import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderBuilder } from "@/components/content/OrderBuilder";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getPlan, getPosts, TYPE_LABEL } from "@/lib/content";
import { getAudits } from "@/lib/feedAudit";
import { getOrders, ORDER_TYPES } from "@/lib/orders";
import { getProfile, PROFILE_FIELDS, profileCompleteness } from "@/lib/profile";
import { criarRascunhosAction, gerarLoteAction, saveOrderAction } from "./actions";
import { claudeOn, custoUSD } from "@/lib/claudeGen";

export const dynamic = "force-dynamic";
/** Cada lote gerado pela API do Claude roda numa chamada; dá folga para os lotes mais longos. */
export const maxDuration = 300;

const SKILL_NAME = "gerar-conteudo-cliente";

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function GerarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireAdmin();
  const c = await getClient(slug);
  if (!c) notFound();
  const [p, plan, posts, audits, orders] = await Promise.all([getProfile(slug), getPlan(slug), getPosts(slug), getAudits(slug), getOrders(slug)]);
  const servicos = String(p.servicos ?? "").split("\n").map((s) => s.replace(/^[-•\s]+/, "").trim()).filter(Boolean);
  const perfil = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.label, String(p[f.key] ?? "").trim()]).filter(([, v]) => v));
  const recentes = [...posts].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 30)
    .map((x) => `${x.date} · ${TYPE_LABEL[x.type]} · ${x.status} · ${x.title}`);
  const audit = audits[0];
  const context = {
    cliente: { slug, nome: c.name, especialidade: c.specialty, instagram: p.instagram || undefined },
    perfil,
    plano: { posts_por_semana: plan.postsPerWeek, mix_formatos: plan.mix, pilares: plan.pillars, hashtags_max: plan.hashtagsMax },
    ja_planejados_ou_publicados: recentes,
    ultima_leitura_do_feed: audit ? { nota: audit.total, quando: audit.at.slice(0, 10), pontos: audit.items.filter((i) => i.tip).map((i) => `${i.label}: ${i.tip}`) } : undefined,
  };
  const done = profileCompleteness(p);
  const ultimaGerada = orders.find((o) => o.geracao?.pecas.length);

  return (
    <Shell active="gerar" session={session} clientSlug={slug}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="label">{c.name} · {c.specialty}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Gerar conteúdo</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">Escolha o que quer para o período. O Claude lê o Instagram deste cliente, o que deu certo, o que está sendo falado na área e cruza com os serviços. Cada cliente é tratado separado.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/cliente/${slug}/perfil`} className={`pill ${done >= 70 ? "pill-green" : "pill-yellow"}`}>Perfil {done}%</Link>
          <span className="pill">{posts.length} posts no planejamento</span>
          {audit ? <span className="pill">Feed hoje: {audit.total}</span> : <Link href={`/cliente/${slug}/perfil`} className="pill pill-yellow">Feed ainda não lido</Link>}
        </div>
      </div>

      <OrderBuilder types={ORDER_TYPES.map((t) => ({ ...t, options: [...t.options] }))} servicos={servicos} context={context} save={saveOrderAction.bind(null, slug)} skill={SKILL_NAME}
        slug={slug} apiOn={claudeOn()} gerar={gerarLoteAction.bind(null, slug)} criar={criarRascunhosAction.bind(null, slug)}
        ultima={ultimaGerada ? { id: ultimaGerada.id, pecas: ultimaGerada.geracao!.pecas, perguntas: ultimaGerada.geracao!.perguntas, custo: ultimaGerada.geracao!.custo ?? custoUSD(ultimaGerada.geracao!.model, ultimaGerada.geracao!.input, ultimaGerada.geracao!.output), criados: ultimaGerada.geracao!.criados ?? {} } : undefined} />

      {orders.length > 0 && (
        <section className="mt-6 flex flex-col gap-2">
          <h2 className="font-semibold">Pedidos anteriores</h2>
          <div className="card scroll-x">
            <table className="data">
              <thead><tr><th>Quando</th><th>Quem</th><th>Período</th><th>Pedido</th></tr></thead>
              <tbody>
                {orders.slice(0, 12).map((o) => (
                  <tr key={o.id}><td>{when(o.at)}</td><td>{o.by}</td><td>{o.periodo}</td>
                    <td className="text-left">{ORDER_TYPES.filter((t) => o.quantidades[t.key]).map((t) => `${o.quantidades[t.key]} ${t.label.toLowerCase()}`).join(", ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Shell>
  );
}
