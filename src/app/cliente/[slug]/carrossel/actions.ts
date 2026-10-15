"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/brandStore";
import { cleanDoc, docText, type CarouselDoc } from "@/lib/carousel";
import { renderDoc } from "@/lib/carouselRender";
import { claudeOn, MODEL } from "@/lib/claudeGen";
import { getClient } from "@/lib/clients";
import { getPosts, savePosts, type Post } from "@/lib/content";
import { getProfile } from "@/lib/profile";
import { localDir } from "@/lib/store";

export interface BuildResult { ok: boolean; message: string; previews?: string[]; warnings?: string[]; postId?: string }

async function load(slug: string, json: string) {
  const s = await requireAdmin();
  if (!(await getClient(slug))) throw new Error("Cliente não encontrado.");
  const doc = cleanDoc(JSON.parse(json || "null"), slug);
  if (!doc) throw new Error("Carrossel vazio.");
  return { s, kit: await getBrand(slug), doc };
}

/** Monta os slides em tamanho reduzido para conferir na tela (é o JPG de verdade, só menor). */
export async function previewDocAction(slug: string, json: string): Promise<BuildResult> {
  try {
    const { kit, doc } = await load(slug, json);
    const r = await renderDoc(slug, kit, doc, { width: 540 });
    return { ok: true, message: `${doc.slides.length} slides montados.`, previews: r.jpgs.map((b) => `data:image/jpeg;base64,${b.toString("base64")}`), warnings: r.warnings };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function saveJpg(path: string, b: Buffer) {
  const dir = localDir();
  if (dir) {
    const fs = await import("fs/promises");
    await fs.mkdir(`${dir}/${path.slice(0, path.lastIndexOf("/"))}`, { recursive: true });
    await fs.writeFile(`${dir}/${path}`, new Uint8Array(b));
    return;
  }
  await put(path, b, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
}

/**
 * Monta em 1080x1350, salva os JPGs e grava o post no planejamento.
 * Sem `postId`: cria um rascunho. Com `postId`: troca os slides do post (se ainda não foi publicado).
 */
export async function saveDocAction(slug: string, json: string, opts: { postId?: string; caption: string; date: string; time: string }): Promise<BuildResult> {
  try {
    const { s, kit, doc } = await load(slug, json);
    if (doc.slides.length < 2) return { ok: false, message: "Carrossel precisa de pelo menos 2 slides." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date) || !/^\d{2}:\d{2}$/.test(opts.time)) return { ok: false, message: "Escolha data e horário." };
    const posts = await getPosts(slug);
    const old = opts.postId ? posts.find((p) => p.id === opts.postId) : undefined;
    if (opts.postId && !old) return { ok: false, message: "Post não encontrado." };
    if (old && (old.status === "publicado" || old.publish?.igMediaId)) return { ok: false, message: "Este post já foi publicado: os slides não podem mais ser trocados." };

    const r = await renderDoc(slug, kit, doc);
    const id = old?.id ?? crypto.randomUUID();
    const v = Date.now().toString(36); // versão no nome: a miniatura não fica presa no cache depois de editar
    const media = await Promise.all(r.jpgs.map(async (b, i) => {
      const path = `content-media/${slug}/carrosseis/${id}/${v}-${String(i + 1).padStart(2, "0")}.jpg`;
      await saveJpg(path, b);
      return { path, kind: "image" as const, mime: "image/jpeg", name: `slide-${i + 1}.jpg` };
    }));
    const now = new Date().toISOString();
    const caption = opts.caption.replace(/\r\n?/g, "\n").slice(0, 2200);
    const firstTitle = doc.slides[0].layout.boxes.filter((b) => b.kind === "titulo" && doc.slides[0].text[b.id]).sort((a, b) => a.y - b.y)[0];
    const title = (firstTitle ? doc.slides[0].text[firstTitle.id] : "Carrossel").replace(/\*/g, "").slice(0, 120);
    let next: Post[];
    if (old) {
      // Slides novos voltam para revisão se o cliente já tinha aprovado ou estava agendado.
      const back = old.status === "aprovado" || old.status === "agendado";
      const updated: Post = {
        ...old, media, carrossel: doc, caption, date: opts.date, time: opts.time, updatedAt: now, publish: undefined,
        status: back ? "aguardando" : old.status,
        history: [...old.history, { at: now, by: s.name, role: s.role, action: "editado", note: back ? "Slides do carrossel alterados: voltou para aprovação" : "Slides do carrossel alterados" }],
      };
      next = posts.map((p) => (p.id === id ? updated : p));
    } else {
      next = [...posts, {
        id, type: "carrossel", title, caption, media, carrossel: doc, date: opts.date, time: opts.time, status: "rascunho", createdAt: now, updatedAt: now,
        roteiro: `Montado no Kit de marca com o modelo ${doc.templateName}.\n\n${docText(doc)}`,
        history: [{ at: now, by: s.name, role: s.role, action: "criado", note: `Carrossel montado (modelo ${doc.templateName})` }],
      }];
    }
    await savePosts(slug, next);
    revalidatePath(`/cliente/${slug}/conteudo`);
    return { ok: true, message: old ? "Slides atualizados no post." : `Carrossel criado como rascunho em ${opts.date.split("-").reverse().join("/")} às ${opts.time}.`, postId: id, warnings: r.warnings };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Escreve os slides e a legenda com o Claude, no formato com ---, respeitando perfil, regras do kit e os limites do modelo. */
export async function writeWithClaudeAction(slug: string, templateId: string, tema: string): Promise<BuildResult & { text?: string; caption?: string }> {
  try {
    await requireAdmin();
    if (!claudeOn()) return { ok: false, message: "A chave da API do Claude não está configurada no painel (ANTHROPIC_API_KEY)." };
    if (!tema.trim()) return { ok: false, message: "Escreva o tema ou cole o roteiro de base." };
    const [c, kit, p] = await Promise.all([getClient(slug), getBrand(slug), getProfile(slug)]);
    const t = kit.templates?.find((m) => m.id === templateId);
    if (!c || !t) return { ok: false, message: "Escolha um modelo do kit." };
    const lim = (k: "capa" | "texto" | "imagem" | "final") => {
      const bs = t.slides[k].boxes;
      const n = (kind: "titulo" | "texto") => bs.filter((b) => b.kind === kind && b.auto !== "numero").reduce((a, b) => Math.max(a, b.maxWords ?? 0), 0);
      return `${k}: título até ${n("titulo")} palavras${n("texto") ? `, texto até ${n("texto")}` : ", sem texto de apoio"}${bs.some((b) => b.kind === "imagem") ? ", tem foto" : ""}`;
    };
    const sistema = [
      `Você escreve carrosséis de Instagram para ${c.name} (${c.specialty}).`,
      p.posicionamento && `Posicionamento:\n${p.posicionamento}`,
      p.publico && `Público:\n${p.publico}`,
      p.tomDeVoz && `Tom de voz:\n${p.tomDeVoz}`,
      p.expressoesEvitar && `Nunca usar:\n${p.expressoesEvitar}`,
      kit.rules && `Regras da marca (obrigatórias):\n${kit.rules}`,
      "Regras fixas: português do Brasil, sem emoji, sem hashtags nos slides, sem inventar números, casos ou resultados; respeite o CFM (sem paciente identificável, sem antes e depois, sem promessa de resultado, sem preço de procedimento).",
      `Modelo "${t.name}". Limites por tipo de slide: ${(["capa", "texto", "imagem", "final"] as const).map(lim).join("; ")}. Entre 5 e 8 slides.`,
      t.base === "lista" ? "Modelo de lista: os slides do meio são itens numerados (o número entra sozinho, não escreva)." : "",
      "Marque com [foto] os slides do meio que devem usar o tipo com foto (no máximo 2).",
      "Formato de saída, exatamente:\nSLIDES:\n# título do slide 1 (use *asteriscos* em 1 a 3 palavras de destaque)\ntexto curto\n---\n# título do slide 2\ntexto\n---\n(...)\n---\n# slide final com o CTA\ntexto\nLEGENDA:\nlegenda de 3 a 6 linhas curtas terminando no CTA",
    ].filter(Boolean).join("\n\n");
    const res = await fetch(`${(process.env.ANTHROPIC_API_URL ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(90_000),
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL(), max_tokens: 2000, system: sistema, messages: [{ role: "user", content: `Tema ou roteiro de base:\n\n${tema.slice(0, 6000)}` }] }),
    });
    const j = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, message: `Claude: ${j.error?.message ?? res.status}` };
    const out = (j.content ?? []).filter((x) => x.type === "text").map((x) => x.text).join("\n");
    const text = out.split(/LEGENDA:/i)[0].replace(/^[\s\S]*?SLIDES:\s*/i, "").trim();
    const caption = (out.split(/LEGENDA:/i)[1] ?? "").trim();
    if (!text) return { ok: false, message: "O Claude não devolveu os slides no formato esperado. Tente de novo." };
    return { ok: true, message: "Texto escrito. Confira e abra no editor.", text, caption };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export type { CarouselDoc };
