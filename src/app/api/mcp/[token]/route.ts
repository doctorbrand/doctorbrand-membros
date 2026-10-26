import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { getBrand, saveBrand } from "@/lib/brandStore";
import { modelosDoKit } from "@/lib/brand";
import { carrosseisDoPlanejamento, gravarCarrosseis, receberDoCanva } from "@/lib/carrosseis";
import { getClient, listClients } from "@/lib/clients";
import { linkCanvaValido } from "@/lib/studio";
import { clienteCompleto, equipe, indicacoes, lerSecoes, resumoClientes, SECOES, tudo } from "@/lib/jarvis";

/**
 * Conector da área de membros para o Claude (MCP por HTTP, respostas em JSON).
 * O Estúdio de Carrosséis usa para ler os clientes e os carrosséis do planejamento e para devolver o link do
 * Canva e as imagens de cada carrossel montado. A chave fica no endereço: /api/mcp/<MEMBROS_MCP_TOKEN>.
 * Sem MEMBROS_MCP_TOKEN no Vercel, o conector não existe (404).
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const PROTOCOLOS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const QUEM = "Estúdio de Carrosséis";

function chaveOk(token: string): boolean {
  const certa = process.env.MEMBROS_MCP_TOKEN ?? "";
  if (certa.length < 24) return false;
  const a = Buffer.from(token), b = Buffer.from(certa);
  return a.length === b.length && timingSafeEqual(a, b);
}

const slugOk = (v: unknown) => typeof v === "string" && /^[a-z0-9-]{1,80}$/.test(v);

const LEITURA = { readOnlyHint: true };
const SECOES_SCHEMA = { type: "array", items: { type: "string", enum: [...SECOES, "tudo"] }, description: "Seções a ler. Sem nada: todas, menos anuncios e relatorio (que consultam o painel de tráfego e o Instagram na hora). \"tudo\": todas." };

const FERRAMENTAS = [
  {
    name: "ler_clientes",
    description: "Leitura (Jarvis): lista dos clientes da área de membros, com especialidade e a contagem de posts por status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: LEITURA,
  },
  {
    name: "ler_cliente",
    description: "Leitura (Jarvis): tudo de um cliente — cadastro, perfil estratégico, projeto (etapas, entregas, contrato), plano de conteúdo, posts com legendas, slides, histórico e links das mídias, kit de marca, onboarding e briefing, pedidos de conteúdo, diagnósticos do feed, NPS; anúncios e relatório quando pedidos. Nunca devolve senhas, hashes, tokens ou chaves.",
    inputSchema: { type: "object", properties: { cliente: { type: "string", description: "Slug do cliente (de ler_clientes)." }, secoes: SECOES_SCHEMA }, required: ["cliente"], additionalProperties: false },
    annotations: LEITURA,
  },
  {
    name: "ler_equipe",
    description: "Leitura (Jarvis): usuários da área (equipe e acessos de clientes) com nome, e-mail, papel e último login. Sem senha.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: LEITURA,
  },
  {
    name: "ler_indicacoes",
    description: "Leitura (Jarvis): indicações do Circle DoctorBrand, com status e quem indicou.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: LEITURA,
  },
  {
    name: "ler_tudo",
    description: "Leitura (Jarvis): todos os clientes nas seções pedidas, mais equipe e indicações. Resposta grande: prefira ler_cliente quando a pergunta for sobre um cliente.",
    inputSchema: { type: "object", properties: { secoes: SECOES_SCHEMA }, additionalProperties: false },
    annotations: LEITURA,
  },
  {
    name: "listar_clientes",
    description: "Lista os clientes da área de membros com o que o Estúdio precisa: os modelos de carrossel no Canva (nome e link; o primeiro é o padrão), a pasta do cliente no Canva e o tom de voz e regras.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "listar_carrosseis",
    description: "Carrosséis do planejamento de um cliente que ainda não foram publicados, com legenda, o texto de cada slide (capa, slides, final e a foto indicada) e o modelo do Canva escolhido (vazio: o Estúdio escolhe). Com so_sem_canva, só os que ainda não foram montados.",
    inputSchema: { type: "object", properties: { cliente: { type: "string", description: "Slug do cliente (ex.: fernando-fontes)." }, so_sem_canva: { type: "boolean" } }, required: ["cliente"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "criar_carrossel",
    description: "Cria no planejamento um carrossel em rascunho com título, legenda e o texto dos slides (ex.: escrito no Estúdio a partir de um tema). Mesmo título ainda não publicado: atualiza os slides. Devolve o id do post.",
    inputSchema: {
      type: "object",
      properties: {
        cliente: { type: "string" },
        titulo: { type: "string" },
        legenda: { type: "string" },
        data: { type: "string", description: "AAAA-MM-DD. Sem data: amanhã." },
        modelo: { type: "string", description: "Nome do modelo do Canva (de listar_clientes)." },
        slides: { type: "array", items: { type: "object", properties: { tipo: { type: "string", enum: ["capa", "slide", "final"] }, titulo: { type: "string" }, texto: { type: "string" }, foto: { type: "string" } }, required: ["titulo"] } },
      },
      required: ["cliente", "titulo", "slides"],
      additionalProperties: false,
    },
  },
  {
    name: "salvar_carrossel",
    description: "Recebe o carrossel montado no Canva: guarda o link do design no post e, se vierem, baixa as imagens exportadas (links de exportação do Canva, uma por página na ordem, ou um ZIP) e põe no post. Aprovado com outras imagens volta para rascunho; agendado ou publicado não troca as imagens. Com modelo, guarda o modelo usado.",
    inputSchema: {
      type: "object",
      properties: { cliente: { type: "string" }, post_id: { type: "string" }, canva_link: { type: "string" }, imagens: { type: "array", items: { type: "string" }, maxItems: 12 }, modelo: { type: "string" } },
      required: ["cliente", "post_id", "canva_link"],
      additionalProperties: false,
    },
  },
  {
    name: "salvar_pasta_canva",
    description: "Guarda no kit de marca do cliente o id da pasta dele no Canva, onde o Estúdio põe os carrosséis montados.",
    inputSchema: { type: "object", properties: { cliente: { type: "string" }, pasta_id: { type: "string" } }, required: ["cliente", "pasta_id"], additionalProperties: false },
  },
];

class Erro extends Error {}

async function chamar(nome: string, a: Record<string, unknown>): Promise<unknown> {
  if (nome === "ler_clientes") return { clientes: await resumoClientes() };
  if (nome === "ler_equipe") return { equipe: await equipe() };
  if (nome === "ler_indicacoes") return indicacoes();
  if (nome === "ler_tudo") return tudo(lerSecoes(a.secoes));
  if (nome === "listar_clientes") {
    const cs = (await listClients()).filter((c) => !c.removed);
    const kits = await Promise.all(cs.map((c) => getBrand(c.slug)));
    return { clientes: cs.map((c, i) => ({ slug: c.slug, nome: c.name, especialidade: c.specialty, modelos: modelosDoKit(kits[i]), modelo_canva: modelosDoKit(kits[i])[0]?.link ?? null, pasta_canva: kits[i].canvaPasta ?? null, tom_de_voz: kits[i].rules ?? "" })) };
  }
  if (!slugOk(a.cliente) || !(await getClient(String(a.cliente)))) throw new Erro("Cliente não encontrado. Use o slug de listar_clientes.");
  const slug = String(a.cliente);

  if (nome === "ler_cliente") return clienteCompleto(slug, lerSecoes(a.secoes));

  if (nome === "listar_carrosseis") return { carrosseis: await carrosseisDoPlanejamento(slug, { soSemCanva: a.so_sem_canva === true }) };

  if (nome === "criar_carrossel") {
    const amanha = new Date(Date.now() + 864e5).toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 10);
    const data = typeof a.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.data) ? a.data : amanha;
    const r = await gravarCarrosseis(slug, [{ titulo: String(a.titulo ?? ""), legenda: String(a.legenda ?? ""), slides: (a.slides as never) ?? [], ...(typeof a.modelo === "string" && a.modelo.trim() ? { modelo: a.modelo } : {}) }], { start: data, everyDays: 1, time: "12:00", por: QUEM, papel: "admin", nota: "Criado no Estúdio de Carrosséis" });
    if (!r.ids.length) throw new Erro("Dê um título ao carrossel.");
    revalidatePath(`/cliente/${slug}/conteudo`);
    return { post_id: r.ids[0], criado: r.criados > 0 };
  }

  if (nome === "salvar_carrossel") {
    const link = String(a.canva_link ?? "").trim();
    if (!linkCanvaValido(link)) throw new Erro("canva_link precisa ser um link https do Canva.");
    const imagens = Array.isArray(a.imagens) ? a.imagens.map(String) : [];
    const modelo = typeof a.modelo === "string" && a.modelo.trim() ? a.modelo.trim() : undefined;
    const r = await receberDoCanva(slug, String(a.post_id ?? ""), { link, imagens, modelo, por: QUEM, papel: "admin" });
    revalidatePath(`/cliente/${slug}/conteudo`);
    return { ok: true, titulo: r.titulo, imagens: r.imagens, voltou_para_rascunho: r.voltou };
  }

  if (nome === "salvar_pasta_canva") {
    const id = String(a.pasta_id ?? "").trim();
    if (!/^[\w-]{4,80}$/.test(id)) throw new Erro("pasta_id inválido.");
    await saveBrand(slug, { canvaPasta: id }, QUEM);
    revalidatePath(`/cliente/${slug}/marca`);
    return { ok: true };
  }
  throw new Erro(`Ferramenta desconhecida: ${nome}`);
}

type Msg = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

async function responder(m: Msg): Promise<object | null> {
  const id = m.id ?? null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const falha = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (!m.method) return falha(-32600, "Pedido inválido.");
  if (m.method.startsWith("notifications/")) return null;
  switch (m.method) {
    case "initialize": {
      const pedido = String(m.params?.protocolVersion ?? "");
      return ok({
        protocolVersion: PROTOCOLOS.includes(pedido) ? pedido : PROTOCOLOS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "Área de membros DoctorBrand", version: "1.0.0" },
        instructions: "Área de membros DoctorBrand. Para ler qualquer coisa (Jarvis): ler_clientes, ler_cliente, ler_equipe, ler_indicacoes, ler_tudo. Para carrosséis no Canva: listar_clientes, listar_carrosseis e, depois de montar, salvar_carrossel.",
      });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: FERRAMENTAS });
    case "tools/call": {
      const nome = String(m.params?.name ?? "");
      const args = (m.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const r = await chamar(nome, args);
        return ok({ content: [{ type: "text", text: JSON.stringify(r) }], structuredContent: r });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return ok({ content: [{ type: "text", text: msg }], isError: true });
      }
    }
    default: return falha(-32601, `Método não suportado: ${m.method}`);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!chaveOk(token)) return new Response("Não encontrado", { status: 404 });
  let corpo: unknown;
  try { corpo = await req.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido." } }, { status: 400 }); }
  const lista = Array.isArray(corpo) ? (corpo as Msg[]) : [corpo as Msg];
  const respostas = (await Promise.all(lista.map(responder))).filter(Boolean);
  if (!respostas.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(corpo) ? respostas : respostas[0], { headers: { "Cache-Control": "no-store" } });
}

/** Sem fluxo de eventos (SSE): o conector só responde a POST. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!chaveOk(token)) return new Response("Não encontrado", { status: 404 });
  return new Response("Use POST.", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ token: string }> }) {
  return GET(req, ctx);
}
