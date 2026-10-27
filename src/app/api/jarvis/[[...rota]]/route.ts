import { timingSafeEqual } from "crypto";
import { clienteCompleto, equipe, indicacoes, lerSecoes, resumoClientes, resumoConteudo, SECOES, SECOES_PADRAO, tudo } from "@/lib/jarvis";

/**
 * API de leitura para o Jarvis: todo o conteúdo da área de membros em JSON, sem senhas, hashes, tokens ou chaves.
 * Só GET. A chave vai no cabeçalho: Authorization: Bearer <JARVIS_API_TOKEN>. Sem JARVIS_API_TOKEN no Vercel
 * (ou com menos de 24 caracteres), a API não existe (404).
 *
 *   GET /api/jarvis                          o que existe aqui
 *   GET /api/jarvis/resumo                   conteúdo de todos os clientes em números, para o briefing e o registro diário
 *   GET /api/jarvis/clientes                 lista dos clientes, com a contagem de posts
 *   GET /api/jarvis/clientes/<slug>          tudo de um cliente (?secoes=perfil,conteudo,... ou ?secoes=tudo)
 *   GET /api/jarvis/equipe                   usuários (sem senha)
 *   GET /api/jarvis/indicacoes               indicações do Circle
 *   GET /api/jarvis/tudo                     todos os clientes, equipe e indicações (?secoes=...)
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function chaveOk(req: Request): boolean {
  const certa = process.env.JARVIS_API_TOKEN ?? "";
  if (certa.length < 24) return false;
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const a = Buffer.from(m[1].trim()), b = Buffer.from(certa);
  return a.length === b.length && timingSafeEqual(a, b);
}

const json = (dados: unknown, status = 200) => Response.json(dados, { status, headers: { "Cache-Control": "no-store" } });
const slugOk = (v: string) => /^[a-z0-9-]{1,80}$/.test(v);

export async function GET(req: Request, ctx: { params: Promise<{ rota?: string[] }> }) {
  if (!process.env.JARVIS_API_TOKEN || process.env.JARVIS_API_TOKEN.length < 24) return new Response("Não encontrado", { status: 404 });
  if (!chaveOk(req)) return json({ erro: "Chave inválida. Use o cabeçalho Authorization: Bearer <chave>." }, 401);

  const rota = (await ctx.params).rota ?? [];
  const secoes = lerSecoes(new URL(req.url).searchParams.get("secoes"));

  if (rota.length === 0) {
    return json({
      api: "Área de membros DoctorBrand, leitura para o Jarvis",
      rotas: ["/api/jarvis/resumo", "/api/jarvis/clientes", "/api/jarvis/clientes/<slug>?secoes=...", "/api/jarvis/equipe", "/api/jarvis/indicacoes", "/api/jarvis/tudo?secoes=..."],
      secoes: SECOES,
      secoes_padrao: SECOES_PADRAO,
      observacao: "Senhas, hashes, tokens e chaves nunca são devolvidos. Links de mídia do Blob valem 24 horas.",
    });
  }
  if (rota[0] === "resumo" && rota.length === 1) return json(await resumoConteudo());
  if (rota[0] === "clientes" && rota.length === 1) return json({ clientes: await resumoClientes() });
  if (rota[0] === "clientes" && rota.length === 2) {
    if (!slugOk(rota[1])) return json({ erro: "Slug inválido." }, 400);
    const c = await clienteCompleto(rota[1], secoes);
    return c ? json(c) : json({ erro: "Cliente não encontrado." }, 404);
  }
  if (rota[0] === "equipe" && rota.length === 1) return json({ equipe: await equipe() });
  if (rota[0] === "indicacoes" && rota.length === 1) return json(await indicacoes());
  if (rota[0] === "tudo" && rota.length === 1) return json(await tudo(secoes));
  return json({ erro: "Rota não encontrada. Veja GET /api/jarvis." }, 404);
}
