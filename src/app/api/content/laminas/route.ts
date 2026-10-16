import { get } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { getBrand } from "@/lib/brandStore";
import { getPosts, mediaBelongsTo, type Media } from "@/lib/content";
import { driveFetch } from "@/lib/drive";
import { ESTILO_PADRAO, nomeArquivo, ordenar } from "@/lib/laminas";
import { gerarPptx } from "@/lib/laminasPptx";
import { localDir } from "@/lib/store";

export const maxDuration = 60;

/** Bytes da foto (Drive ou Blob deste cliente). */
async function bytes(slug: string, m: Media): Promise<Buffer | null> {
  if (m.driveId) {
    const r = await driveFetch(m.driveId);
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!r.ok || type === "text/html") return null;
    return Buffer.from(await r.arrayBuffer());
  }
  if (!m.path || !mediaBelongsTo(m.path, slug)) return null;
  const dir = localDir();
  if (dir) {
    const fs = await import("fs/promises");
    return fs.readFile(`${dir}/${m.path}`).catch(() => null);
  }
  const res = await get(m.path, { access: "private" }).catch(() => null);
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

/**
 * Arquivo .pptx de um carrossel, para arrastar no Canva (uma página editável por lâmina).
 * GET ?slug=…&post=…&n=… (n = número do carrossel no lote, para o nome "01 Título.pptx").
 */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "admin") return new Response("Não autorizado", { status: 401 });
  const q = new URL(req.url).searchParams;
  const slug = q.get("slug") ?? "";
  if (!/^[a-z0-9-]+$/.test(slug)) return new Response("Cliente inválido", { status: 400 });
  const post = (await getPosts(slug)).find((p) => p.id === q.get("post"));
  if (!post?.laminas) return new Response("Este carrossel ainda não tem lâminas.", { status: 404 });
  const kit = await getBrand(slug);
  const estilo = (kit.estilos ?? []).find((e) => e.id === post.laminas!.estiloId) ?? kit.estilos?.[0] ?? ESTILO_PADRAO;
  const n = Math.max(1, Math.min(99, Number(q.get("n")) || 1));

  const sharp = (await import("sharp")).default;
  const cache = new Map<string, Promise<Buffer | null>>();
  let falhas = 0;
  const buf = await gerarPptx(ordenar(post.laminas.itens), estilo, post.title, async (m, w, h, pb, cantos) => {
    const k = m.driveId ?? m.path ?? "";
    if (!cache.has(k)) cache.set(k, bytes(slug, m).catch(() => null));
    const orig = await cache.get(k)!;
    if (!orig) { falhas++; return null; }
    // Recorte já no tamanho da área (com folga para ajustar no Canva); o foco vai para a parte mais marcante da foto.
    const f = Math.min(1.25, 1620 / Math.max(w, h));
    let img = sharp(orig).rotate().resize(Math.round(w * f), Math.round(h * f), { fit: "cover", position: "attention" });
    if (pb) img = img.grayscale();
    if (cantos) {
      // Cantos arredondados: recorta e pinta os cantos com a cor do fundo da lâmina (JPEG não tem transparência).
      const [rw, rh, r] = [Math.round(w * f), Math.round(h * f), Math.round(cantos.raio * f)];
      const mascara = Buffer.from(`<svg width="${rw}" height="${rh}"><rect width="${rw}" height="${rh}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
      const recortada = await img.png().toBuffer();
      img = sharp(recortada).composite([{ input: mascara, blend: "dest-in" }]).flatten({ background: cantos.fundo });
    }
    return (await img.jpeg({ quality: 84, mozjpeg: true }).toBuffer()).toString("base64");
  });
  const nome = `${nomeArquivo(n, post.title)}.pptx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w .-]/g, "")}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "X-Fotos-Faltando": String(falhas),
      "Cache-Control": "no-store",
    },
  });
}
