import Link from "next/link";
import { notFound } from "next/navigation";
import { Copiar } from "@/components/Acessos";
import { ActionButton } from "@/components/content/ContentActions";
import { Shell } from "@/components/Shell";
import { requireAuth } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { AREAS, areaDoCliente, getPedidosRadar, noticiasDaArea, radarLigado, type NoticiaRadar } from "@/lib/radar";
import { pedirConteudoRadarAction } from "./actions";

export const dynamic = "force-dynamic";

const POR_PAGINA = 30;
const dataBR = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const quando = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));
const novo = (n: NoticiaRadar) => !!n.adicionado && Date.now() - Date.parse(n.adicionado) < 72 * 3600e3;

/** Radar do cliente: notícias da especialidade dele, com a ideia de conteúdo e o pedido para a equipe. */
export default async function RadarClientePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ regiao?: string; cat?: string; n?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  const c = await getClient(slug);
  if (!c) notFound();
  const area = areaDoCliente(c);
  const admin = session.role === "admin";

  let itens: NoticiaRadar[] = [];
  let erro = "";
  if (area && radarLigado()) {
    try { itens = await noticiasDaArea(area); } catch (e) { erro = e instanceof Error ? e.message : "Radar fora do ar."; }
  }
  const pedidos = await getPedidosRadar(slug);
  const pedido = new Map(pedidos.map((p) => [p.noticia, p]));

  const regiao = sp.regiao === "Brasil" || sp.regiao === "Mundo" ? sp.regiao : "";
  const cats = [...new Set(itens.map((n) => n.categoria).filter(Boolean))] as string[];
  const cat = sp.cat && cats.includes(sp.cat) ? sp.cat : "";
  const lista = itens.filter((n) => (!regiao || n.regiao === regiao) && (!cat || n.categoria === cat));
  const limite = Math.min(Math.max(Number(sp.n) || POR_PAGINA, POR_PAGINA), 300);
  const href = (q: { regiao?: string; cat?: string; n?: number }) => {
    const p = new URLSearchParams();
    const r = q.regiao ?? regiao, k = q.cat ?? cat;
    if (r) p.set("regiao", r);
    if (k) p.set("cat", k);
    if (q.n) p.set("n", String(q.n));
    const s = p.toString();
    return `/cliente/${slug}/radar${s ? `?${s}` : ""}`;
  };

  return (
    <Shell active="radar" session={session} clientSlug={slug}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Radar{area ? ` · ${AREAS[area].nome}` : ""}</p>
          <h1 className="mt-1.5">O que está em pauta <i>na sua área.</i></h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">Notícias {area ? `de ${AREAS[area].nome.toLowerCase()}` : ""} no Brasil e no mundo, escolhidas pela DoctorBrand todos os dias, cada uma com uma ideia de como virar conteúdo seu. Gostou de uma? Peça, e a equipe prepara para você aprovar.</p>
        </div>
      </section>

      {!area && <section className="card p-5 text-[14px] text-[var(--muted)]">{admin ? `O Radar ainda não cobre a especialidade deste cliente (${c.specialty}). Hoje ele cobre cirurgia plástica, oftalmologia e odontologia.` : "O Radar da sua especialidade ainda não está disponível."}</section>}
      {area && !radarLigado() && <section className="card p-5 text-[14px] text-[var(--muted)]">{admin ? "Falta o código do Radar (RADAR_CODIGO) na Vercel para esta página funcionar." : "O Radar volta em instantes."}</section>}
      {erro && <section className="card p-5 text-[14px] g-bad">{admin ? `Não consegui ler o Radar: ${erro}` : "Não consegui carregar o Radar agora. Tente de novo em instantes."}</section>}

      {admin && pedidos.length > 0 && (
        <section className="card p-5 mb-4">
          <h2 className="pj-h2">Pedidos do cliente pelo Radar</h2>
          <ul className="rd-pedidos mt-2">
            {pedidos.slice(0, 8).map((p) => <li key={p.noticia}><span className="text-[var(--muted)]">{quando(p.at)}</span> {p.titulo} <span className="text-[var(--muted)]">· {p.por}</span></li>)}
          </ul>
        </section>
      )}

      {area && radarLigado() && !erro && (
        <>
          <nav className="rd-filtros" aria-label="Filtros">
            <div className="flex flex-wrap gap-1.5">
              {[["", "Tudo"], ["Brasil", "Brasil"], ["Mundo", "Mundo"]].map(([v, l]) => (
                <Link key={l} href={href({ regiao: v, n: 0 })} className={`ct-chip ${regiao === v ? "is-on" : ""}`} aria-current={regiao === v ? "true" : undefined}>{l}</Link>
              ))}
            </div>
            {cats.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <Link href={href({ cat: "", n: 0 })} className={`ct-chip ${!cat ? "is-on" : ""}`}>Todos os temas</Link>
                {cats.map((k) => <Link key={k} href={href({ cat: k, n: 0 })} className={`ct-chip ${cat === k ? "is-on" : ""}`}>{k}</Link>)}
              </div>
            )}
          </nav>

          {lista.length === 0 ? (
            <section className="card p-6 text-center text-[14px] text-[var(--muted)]">{itens.length ? "Nada com esses filtros." : "As primeiras notícias da sua área chegam na próxima varredura diária."}</section>
          ) : (
            <ul className="rd-lista">
              {lista.slice(0, limite).map((n) => {
                const url = n.url && /^https?:\/\//.test(n.url) ? n.url : undefined;
                const p = pedido.get(n.id);
                return (
                  <li key={n.id} className="card rd-item">
                    <div className="rd-top">
                      <span>{dataBR(n.data)}</span>
                      {novo(n) && <span className="rd-tag is-novo">Novo</span>}
                      {n.regiao && <span className={`rd-tag ${n.regiao === "Brasil" ? "is-br" : "is-mundo"}`}>{n.regiao}</span>}
                      {n.categoria && <span className="rd-tag">{n.categoria}</span>}
                    </div>
                    <h3 className="rd-titulo">{url ? <a href={url} target="_blank" rel="noreferrer noopener">{n.titulo}</a> : n.titulo}</h3>
                    {n.resumo && <p className="rd-resumo">{n.resumo}</p>}
                    {(n.angulo || n.gancho) && (
                      <div className="rd-ideia">
                        <div className="rd-ideia-head"><span>Ideia de conteúdo</span>{n.formato && <b>{n.formato}</b>}</div>
                        {n.angulo && <p>{n.angulo}</p>}
                        {n.gancho && (
                          <div className="rd-gancho">
                            <span className="rd-gancho-label">Primeira frase</span>
                            <span className="rd-gancho-txt">&ldquo;{n.gancho}&rdquo;</span>
                            <Copiar texto={n.gancho} label="Copiar a frase" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="rd-foot">
                      <span className="rd-fonte">Fonte: {url ? <a href={url} target="_blank" rel="noreferrer noopener">{n.fonte || "abrir"}</a> : n.fonte || "não informada"}</span>
                      {p ? <span className="rd-ok">Pedido enviado em {quando(p.at)}</span> : <ActionButton action={pedirConteudoRadarAction.bind(null, slug, n.id)} label="Quero um conteúdo sobre isso" variant={admin ? "ghost" : "dark"} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {lista.length > limite && <div className="flex justify-center mt-4"><Link href={href({ n: limite + POR_PAGINA })} className="ct-btn" scroll={false}>Ver mais {Math.min(POR_PAGINA, lista.length - limite)}</Link></div>}
        </>
      )}
    </Shell>
  );
}
