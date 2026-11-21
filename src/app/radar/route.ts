import { getRealSession } from "@/lib/auth";
import { comFrentesEAlertas } from "@/lib/radarPagina";

export const dynamic = "force-dynamic";

const RADAR = "https://radar.doctorbrand.co";

/**
 * Radar pelo menu da equipe, sem tela de código: busca a página do Radar e a devolve já com o
 * código de acesso (RADAR_CODIGO, na Vercel). Só para quem está logado como equipe.
 * Sem o código configurado, ou se o Radar não responder, cai no endereço de sempre.
 */
export async function GET(req: Request) {
  const s = await getRealSession();
  if (!s) return Response.redirect(new URL("/login", req.url), 302);
  if (s.role !== "admin") return Response.redirect(new URL("/", req.url), 302);

  const codigo = process.env.RADAR_CODIGO?.trim().toUpperCase();
  if (!codigo) return Response.redirect(RADAR, 302);

  let html: string;
  try {
    const r = await fetch(RADAR, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    html = await r.text();
  } catch {
    return Response.redirect(RADAR, 302);
  }

  const js = JSON.stringify(codigo).replace(/</g, "\\u003c");
  const boot = `<script>try{localStorage.setItem("radar_codigo",${js})}catch(e){}window.__RADAR_CODIGO=${js};</script>`;
  html = html.replace("const saved=read(KEY);", "const saved=window.__RADAR_CODIGO||read(KEY);").replace("<script>", `${boot}\n<script>`);
  html = comFrentesEAlertas(html);

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
    },
  });
}

