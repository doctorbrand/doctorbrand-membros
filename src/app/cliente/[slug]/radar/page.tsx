import Link from "next/link";
import { notFound } from "next/navigation";
import { Copiar } from "@/components/Acessos";
import { ActionButton } from "@/components/content/ContentActions";
import { Shell } from "@/components/Shell";
import { requireAuth } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { AREAS, areaDoCliente, frentesDoCliente, getPedidosRadar, noticiasDaArea, radarLigado, type AreaRadar, type NoticiaRadar, type PedidoRadar } from "@/lib/radar";
import { pedirConteudoRadarAction } from "./actions";

export const dynamic = "force-dynamic";

const POR_PAGINA = 30;
const dataBR = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const quando = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));
const novo = (n: NoticiaRadar) => !!n.adicionado && Date.now() - Date.parse(n.adicionado) < 72 * 3600e3;
const diasAtras = (iso?: string) => (iso ? (Date.now() - Date.parse(`${iso}T12:00:00Z`)) / 864e5 : 999);

/** Principais: relevância 4 ou 5 das últimas 3 semanas, de todas as frentes do cliente, sem repetir. */
function principais(porFrente: Map<AreaRadar, NoticiaRadar[]>): (NoticiaRadar & { frente: AreaRadar })[] {
  const vistos = new Set<string>();
  const todas: (NoticiaRadar & { frente: AreaRadar })[] = [];
  for (const [frente, itens] of porFrente) for (const n of itens) if (!vistos.has(n.id)) { vistos.add(n.id); todas.push({ ...n, frente }); }
  const fortes = todas.filter((n) => (n.relevancia ?? 0) >= 4 && diasAtras(n.data) <= 21);
  const lista = fortes.length >= 3 ? fortes : todas.filter((n) => diasAtras(n.data) <= 21);
  return lista.sort((a, b) => (b.relevancia ?? 0) - (a.relevancia ?? 0) || (b.data ?? "").localeCompare(a.data ?? "")).slice(0, 8);
}

/** Radar do cliente: a especialidade dele, Tecnologia e Mercado médico, com as principais da semana no topo. */
export default async function RadarClientePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ aba?: string; regiao?: string; cat?: string; n?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  const c = await getClient(slug);
  if (!c) notFound();
  const frentes = frentesDoCliente(c);
  const esp = areaDoCliente(c);
  const admin = session.role === "admin";

  const porFrente = new Map<AreaRadar, NoticiaRadar[]>();
  let erro = "";
  if (frentes.length && radarLigado()) {
    const r = await Promise.allSettled(frentes.map((a) => noticiasDaArea(a)));
    r.forEach((x, i) => { if (x.status === "fulfilled") porFrente.set(frentes[i], x.value); else erro ||= x.reason instanceof Error ? x.reason.message : "Radar fora do ar."; });
    if (porFrente.size) erro = "";
  }
  const pedidos = await getPedidosRadar(slug);
  const pedido = new Map(pedidos.map((p) => [p.noticia, p]));

  const aba: "principais" | AreaRadar = sp.aba && frentes.includes(sp.aba as AreaRadar) ? (sp.aba as AreaRadar) : "principais";
  const itensAba = aba === "principais" ? [] : porFrente.get(aba) ?? [];
  const regiao = sp.regiao === "Brasil" || sp.regiao === "Mundo" ? sp.regiao : "";
  const cats = [...new Set(itensAba.map((n) => n.categoria).filter(Boolean))] as string[];
  const cat = sp.cat && cats.includes(sp.cat) ? sp.cat : "";
  const lista = aba === "principais" ? principais(porFrente) : itensAba.filter((n) => (!regiao || n.regiao === regiao) && (!cat || n.categoria === cat));
  const limite = Math.min(Math.max(Number(sp.n) || POR_PAGINA, POR_PAGINA), 300);
  const href = (q: { aba?: string; regiao?: string; cat?: string; n?: number }) => {
    const p = new URLSearchParams();
    const a = q.aba ?? aba, r = q.aba !== undefined ? "" : q.regiao ?? regiao, k = q.aba !== undefined ? "" : q.cat ?? cat;
    if (a !== "principais") p.set("aba", a);
    if (r) p.set("regiao", r);
    if (k) p.set("cat", k);
    if (q.n) p.set("n", String(q.n));
    const s = p.toString();
    return `/cliente/${slug}/radar${s ? `?${s}` : ""}`;
  };
  const pronto = frentes.length > 0 && radarLigado() && !erro;

  return (
    <Shell active="radar" session={session} clientSlug={slug}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Radar{esp ? ` · ${AREAS[esp].nome}` : ""}</p>
          <h1 className="mt-1.5">O que está em pauta <i>na sua área.</i></h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">Notícias {esp ? `de ${AREAS[esp].nome.toLowerCase()}, ` : ""}tecnologia e mercado da saúde, escolhidas pela DoctorBrand todos os dias, cada uma com uma ideia de como virar conteúdo seu. Gostou de uma? Peça, e a equipe prepara para você aprovar.</p>
        </div>
      </section>

      {!frentes.length && <section className="card p-5 text-[14px] text-[var(--muted)]">{admin ? `O Radar não cobre a área deste cliente (${c.specialty}).` : "O Radar não está disponível para a sua área."}</section>}
      {frentes.length > 0 && !radarLigado() && <section className="card p-5 text-[14px] text-[var(--muted)]">{admin ? "Falta o código do Radar (RADAR_CODIGO) na Vercel para esta página funcionar." : "O Radar volta em instantes."}</section>}
      {erro && <section className="card p-5 text-[14px] g-bad">{admin ? `Não consegui ler o Radar: ${erro}` : "Não consegui carregar o Radar agora. Tente de novo em instantes."}</section>}

      {admin && pedidos.length > 0 && (
        <section className="card p-5 mb-4">
          <h2 className="pj-h2">Pedidos do cliente pelo Radar</h2>
          <ul className="rd-pedidos mt-2">
            {pedidos.slice(0, 8).map((p) => <li key={p.noticia}><span className="text-[var(--muted)]">{quando(p.at)}</span> {p.titulo} <span className="text-[var(--muted)]">· {p.por}</span></li>)}
          </ul>
        </section>
      )}

      {pronto && (
        <>
          <nav className="rd-abas" aria-label="Frentes do Radar">
            {(["principais", ...frentes] as const).map((a) => (
              <Link key={a} href={href({ aba: a })} className={`rd-aba ${aba === a ? "is-on" : ""}`} aria-current={aba === a ? "page" : undefined}>
                {a === "principais" ? "Principais" : AREAS[a].nome}
                {a !== "principais" && <span className="rd-aba-n">{porFrente.get(a)?.length ?? 0}</span>}
              </Link>
            ))}
          </nav>

          {aba === "principais" ? (
            <p className="text-[13.5px] text-[var(--muted)] mb-3">As notícias de maior peso das últimas três semanas, de todas as suas frentes.</p>
          ) : (
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
          )}

          {lista.length === 0 ? (
            <section className="card p-6 text-center text-[14px] text-[var(--muted)]">{aba !== "principais" && itensAba.length ? "Nada com esses filtros." : "As primeiras notícias desta frente chegam na próxima varredura diária, todo dia antes das 7h."}</section>
          ) : (
            <ul className="rd-lista">
              {lista.slice(0, limite).map((n) => <Cartao key={n.id} n={n} frente={"frente" in n ? (n as { frente: AreaRadar }).frente : undefined} slug={slug} pedido={pedido.get(n.id)} admin={admin} />)}
            </ul>
          )}
          {aba !== "principais" && lista.length > limite && <div className="flex justify-center mt-4"><Link href={href({ n: limite + POR_PAGINA })} className="ct-btn" scroll={false}>Ver mais {Math.min(POR_PAGINA, lista.length - limite)}</Link></div>}
        </>
      )}
    </Shell>
  );
}

function Cartao({ n, frente, slug, pedido, admin }: { n: NoticiaRadar; frente?: AreaRadar; slug: string; pedido?: PedidoRadar; admin: boolean }) {
  const url = n.url && /^https?:\/\//.test(n.url) ? n.url : undefined;
  return (
    <li className="card rd-item">
      <div className="rd-top">
        <span>{dataBR(n.data)}</span>
        {novo(n) && <span className="rd-tag is-novo">Novo</span>}
        {frente && <span className="rd-tag is-frente">{AREAS[frente].nome}</span>}
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
        {pedido ? <span className="rd-ok">Pedido enviado em {quando(pedido.at)}</span> : <ActionButton action={pedirConteudoRadarAction.bind(null, slug, n.id)} label="Quero um conteúdo sobre isso" variant={admin ? "ghost" : "dark"} />}
      </div>
    </li>
  );
}
