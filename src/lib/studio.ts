/**
 * Estúdio de Carrosséis: página do Claude que escreve os slides e monta o carrossel no modelo do cliente
 * no Canva. A área de membros só aponta para ela; o que vem depois do # abre o Estúdio no cliente certo
 * (o id do cliente no Estúdio é o mesmo slug da área de membros).
 */
export const STUDIO_URL = "https://claude.ai/artifact/9Z26jge6ViMW1167SNMPAS";

export const studioHref = (slug: string) => `${STUDIO_URL}#${encodeURIComponent(slug)}`;

/** Link de carrossel no Canva: canva.com ou o link curto canva.link, sempre https. */
export function linkCanvaValido(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && /^(www\.)?canva\.(com|link)$/i.test(u.hostname);
  } catch {
    return false;
  }
}
