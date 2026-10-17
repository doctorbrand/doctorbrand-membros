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

/**
 * Link de um modelo de carrossel: precisa ser um design do Canva (canva.com/design/... ou canva.link). Modelo da
 * marca (brand template) não serve: o Estúdio copia as páginas de um design. Devolve a mensagem de erro, ou null.
 */
export function problemaLinkModelo(v: string): string | null {
  if (!linkCanvaValido(v)) return "O link do modelo precisa ser do Canva (https://www.canva.com/design/... ou https://canva.link/...).";
  if (/\/brand\/brand-templates\//i.test(v)) return "Esse link é de um modelo da marca (brand template). No Canva, abra o modelo, clique em Usar este modelo e cole aqui o link do design que abrir (canva.com/design/...).";
  if (/canva\.com\/folder\//i.test(v)) return "Esse link é de uma pasta. No modelo, cole o link do design (canva.com/design/...).";
  return null;
}
