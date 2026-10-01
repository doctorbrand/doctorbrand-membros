import { createHmac, timingSafeEqual } from "crypto";

/**
 * Links públicos temporários para a Meta baixar as mídias na hora de publicar.
 * O Blob é privado; o link é assinado (HMAC) e expira. Ninguém sem o link consegue listar ou adivinhar nada.
 */
const key = () => `${process.env.PANEL_PASSWORD ?? ""}:media-public:v1`;
const sign = (p: string, exp: number) => createHmac("sha256", key()).update(`${p}|${exp}`).digest("hex");

const DOMINIO = "https://members.doctorbrand.co";
/** Endereço público. O antigo login.doctorbrand.co nunca teve DNS: se ainda estiver na variável, vale o novo. */
export const publicBase = () => {
  const env = process.env.PUBLIC_BASE_URL?.trim();
  return (!env || /login\.doctorbrand\.co/i.test(env) ? DOMINIO : env).replace(/\/$/, "");
};

export function signedMediaUrl(path: string, ttlSeconds = 24 * 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${publicBase()}/api/media/public?p=${encodeURIComponent(path)}&e=${exp}&s=${sign(path, exp)}`;
}

/** Assinatura de um caminho qualquer (ex.: pedido de conteúdo), para links temporários sem login. */
export function signPath(path: string, ttlSeconds: number): { e: number; s: string } {
  const e = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { e, s: sign(path, e) };
}

export function verifySigned(path: string, exp: string | null, sig: string | null): boolean {
  if (!process.env.PANEL_PASSWORD || !exp || !sig) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Date.now() / 1000) return false;
  const good = Buffer.from(sign(path, e));
  const got = Buffer.from(sig);
  return good.length === got.length && timingSafeEqual(good, got);
}
