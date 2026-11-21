import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "crypto";
import { readDoc, writeDoc } from "./store";

/**
 * Acessos do cliente (só a equipe): login e senha de cada plataforma, num documento à parte (cofre/<slug>).
 * A senha nunca é gravada aberta: vai cifrada (AES-256-GCM) e só é aberta quando alguém da equipe toca no olho.
 * Cada abertura fica registrada. A leitura do Jarvis não lê este documento.
 *
 * Chave: ACESSOS_CHAVE na Vercel, se existir. Sem ela, uma chave derivada da senha-mãe do painel.
 * Cada senha guarda qual chave usou, então criar a ACESSOS_CHAVE depois não estraga as que já existem.
 */

export interface Plataforma { id: string; nome: string; dica: string }

export const PLATAFORMAS: Plataforma[] = [
  { id: "instagram", nome: "Instagram", dica: "Login do perfil profissional." },
  { id: "facebook", nome: "Facebook e Página", dica: "Conta pessoal que administra a Página." },
  { id: "meta-business", nome: "Meta Business", dica: "Gerenciador de negócios e de anúncios." },
  { id: "google", nome: "Conta Google", dica: "Gmail usado no Drive, YouTube e Perfil da empresa." },
  { id: "google-ads", nome: "Google Ads", dica: "Conta de anúncios no Google." },
  { id: "google-perfil", nome: "Perfil da empresa no Google", dica: "Cartão da clínica no Google e no Maps." },
  { id: "site", nome: "Site e hospedagem", dica: "Painel do site (WordPress, Wix, hospedagem)." },
  { id: "dominio", nome: "Domínio", dica: "Registro.br, GoDaddy ou outro." },
  { id: "links", nome: "Página de links da bio", dica: "Linktree ou similar." },
  { id: "agendamento", nome: "Agendamento", dica: "Sistema de agenda ou WhatsApp Business." },
];

export interface Cifra { k: "chave" | "painel"; iv: string; tag: string; dado: string }

export interface Credencial {
  id: string;
  /** Só para os acessos adicionados à mão (os da lista usam o nome da plataforma). */
  nome?: string;
  login?: string;
  senha?: Cifra;
  link?: string;
  nota?: string;
  /** Acesso por convite ou parceiro: não precisa de senha. */
  convite?: boolean;
  atualizadoEm: string;
  por: string;
}

export interface Registro { at: string; por: string; acao: "salvou" | "viu" | "apagou"; item: string }
export interface CofreDoc { itens: Record<string, Credencial>; log: Registro[] }

const path = (slug: string) => `cofre/${slug}`;
export const getCofre = (slug: string) => readDoc<CofreDoc>(path(slug), { itens: {}, log: [] });
export const saveCofre = (slug: string, d: CofreDoc) => writeDoc(path(slug), { ...d, log: d.log.slice(-200) });

function chave(k: Cifra["k"]): Buffer | null {
  if (k === "chave") {
    const raw = process.env.ACESSOS_CHAVE?.trim();
    return raw ? createHash("sha256").update(raw).digest() : null;
  }
  const p = process.env.PANEL_PASSWORD;
  return p ? Buffer.from(hkdfSync("sha256", p, "doctorbrand-acessos", "cofre-v1", 32)) : null;
}

export const cofrePronto = () => !!(chave("chave") ?? chave("painel"));
export const usaChavePropria = () => !!chave("chave");

export function cifrar(texto: string): Cifra {
  const k: Cifra["k"] = chave("chave") ? "chave" : "painel";
  const key = chave(k);
  if (!key) throw new Error("Sem chave para guardar senhas. Configure ACESSOS_CHAVE na Vercel.");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const dado = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return { k, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), dado: dado.toString("base64") };
}

/** Abre a senha. Devolve null se a chave mudou ou o dado não confere. */
export function decifrar(x: Cifra): string | null {
  const key = chave(x.k);
  if (!key) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(x.iv, "base64"));
    d.setAuthTag(Buffer.from(x.tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(x.dado, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export type Situacao = "login-senha" | "so-login" | "convite" | "falta";

export function situacao(c?: Credencial): Situacao {
  if (!c) return "falta";
  if (c.login && c.senha) return "login-senha";
  if (c.convite) return "convite";
  if (c.login || c.senha) return "so-login";
  return "falta";
}

export const SITUACAO: Record<Situacao, string> = {
  "login-senha": "Login e senha",
  "so-login": "Incompleto",
  convite: "Por convite",
  falta: "Sem acesso",
};

/** Lista para a tela: as plataformas fixas, na ordem, e depois as adicionadas à mão. */
export function linhas(d: CofreDoc): { id: string; nome: string; dica?: string; cred?: Credencial; extra: boolean }[] {
  const fixas = PLATAFORMAS.map((p) => ({ id: p.id, nome: p.nome, dica: p.dica, cred: d.itens[p.id], extra: false }));
  const extras = Object.values(d.itens)
    .filter((c) => !PLATAFORMAS.some((p) => p.id === c.id))
    .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""))
    .map((c) => ({ id: c.id, nome: c.nome ?? "Outro acesso", cred: c, extra: true }));
  return [...fixas, ...extras];
}
