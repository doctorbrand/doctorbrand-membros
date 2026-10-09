import { createHash, timingSafeEqual } from "crypto";
import { getPosts, savePosts } from "@/lib/content";
import { toJpeg } from "@/lib/drive";
import { saveCover } from "@/lib/seedImports";
import { readDoc, writeDoc } from "@/lib/store";

/**
 * Uso único: coloca no grid da Cecília as capas do planejamento SET/OUT do Notion.
 * Os links de arquivo do Notion valem 5 minutos e só o servidor consegue baixá-los,
 * então a equipe manda os links aqui com um código de uso único. Depois de usado, o código não vale mais.
 */
export const maxDuration = 60;

const HASH = "f8cbec078cc0c7751f42b0182800debfd3139001687be41372c83aa71dab9ac7";
const SLUG = "cecilia-favre";
const DOC = "seed-imports";
const KEY = "cecilia-favre:set-out-2026:capas-notion";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; covers?: { title?: string; url?: string }[] };
  const got = createHash("sha256").update(String(body.token ?? "")).digest();
  if (!timingSafeEqual(got, Buffer.from(HASH, "hex"))) return Response.json({ ok: false, error: "código inválido" }, { status: 401 });
  const done = await readDoc<Record<string, string>>(DOC, {});
  if (done[KEY]) return Response.json({ ok: false, error: "já usado" }, { status: 410 });

  const covers = (body.covers ?? []).filter((c) => c.title && c.url && /^https:\/\/prod-files-secure\.s3\.us-west-2\.amazonaws\.com\//.test(c.url)).slice(0, 20);
  const posts = await getPosts(SLUG);
  const out: { title: string; ok: boolean; error?: string }[] = [];
  await Promise.all(covers.map(async (c) => {
    const p = posts.find((x) => x.title === c.title);
    if (!p) { out.push({ title: c.title!, ok: false, error: "post não encontrado" }); return; }
    try {
      const r = await fetch(c.url!, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const raw = Buffer.from(await r.arrayBuffer());
      const jpg = (r.headers.get("content-type") ?? "").includes("jpeg") ? raw : await toJpeg(raw);
      p.cover = await saveCover(SLUG, p.id, jpg);
      p.updatedAt = new Date().toISOString();
      p.history = [...p.history, { at: p.updatedAt, by: "DoctorBrand", role: "admin", action: "capa", note: "Capa do Notion (Planejamento SET/OUT)" }];
      out.push({ title: c.title!, ok: true });
    } catch (e) {
      out.push({ title: c.title!, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }));
  if (out.some((o) => o.ok)) await savePosts(SLUG, posts);
  if (out.length && out.every((o) => o.ok)) await writeDoc(DOC, { ...done, [KEY]: new Date().toISOString() });
  return Response.json({ ok: out.every((o) => o.ok), out });
}
