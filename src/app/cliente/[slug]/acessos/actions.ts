"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { cifrar, decifrar, getCofre, PLATAFORMAS, saveCofre, type Credencial } from "@/lib/cofre";
import type { ActionResult } from "@/lib/types";

const slugOk = (s: string) => /^[a-z0-9-]{1,80}$/.test(s);
const idOk = (s: string) => /^[a-z0-9-]{1,60}$/.test(s);
const campo = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
const nomeItem = (c: Credencial | undefined, id: string) => c?.nome ?? PLATAFORMAS.find((p) => p.id === id)?.nome ?? id;

async function equipe(slug: string) {
  const s = await requireAdmin();
  if (s.preview) throw new Error("Modo visualização.");
  if (!slugOk(slug) || !(await getClient(slug))) throw new Error("Cliente não encontrado.");
  return s;
}

/** Salva login, senha, link e nota de uma plataforma. Senha em branco mantém a que já existe. */
export async function salvarAcessoAction(slug: string, id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const s = await equipe(slug);
    const novo = id === "novo";
    if (!novo && !idOk(id)) return { ok: false, message: "Item inválido." };
    const nome = campo(fd, "nome", 60);
    if (novo && !nome) return { ok: false, message: "Dê um nome para o acesso (ex.: TikTok, Doctoralia)." };
    const d = await getCofre(slug);
    const key = novo ? `extra-${randomBytes(4).toString("hex")}` : id;
    const cur = d.itens[key];
    if (!novo && !cur && !PLATAFORMAS.some((p) => p.id === key)) return { ok: false, message: "Item inválido." };
    const senha = String(fd.get("senha") ?? "").slice(0, 200);
    const link = campo(fd, "link", 300);
    if (link && !/^https?:\/\//i.test(link)) return { ok: false, message: "O link precisa começar com https://" };
    const item: Credencial = {
      id: key,
      nome: novo ? nome : cur?.nome ?? (nome || undefined),
      login: campo(fd, "login", 200) || undefined,
      senha: senha ? cifrar(senha) : cur?.senha,
      link: link || undefined,
      nota: campo(fd, "nota", 500) || undefined,
      convite: fd.get("convite") === "on",
      atualizadoEm: new Date().toISOString(),
      por: s.name,
    };
    if (!PLATAFORMAS.some((p) => p.id === key) && !item.nome) item.nome = "Outro acesso";
    d.itens[key] = item;
    d.log.push({ at: item.atualizadoEm, por: s.name, acao: "salvou", item: nomeItem(item, key) });
    await saveCofre(slug, d);
    revalidatePath(`/cliente/${slug}/acessos`);
    return { ok: true, message: "Salvo." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Não consegui salvar." };
  }
}

/** Tira só a senha (o login e a nota ficam). */
export async function apagarSenhaAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  try {
    const s = await equipe(slug);
    const d = await getCofre(slug);
    const cur = d.itens[id];
    if (!cur?.senha) return { ok: false, message: "Não há senha salva." };
    d.itens[id] = { ...cur, senha: undefined, atualizadoEm: new Date().toISOString(), por: s.name };
    d.log.push({ at: new Date().toISOString(), por: s.name, acao: "apagou", item: `senha de ${nomeItem(cur, id)}` });
    await saveCofre(slug, d);
    revalidatePath(`/cliente/${slug}/acessos`);
    return { ok: true, message: "Senha apagada." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Não consegui apagar." };
  }
}

/** Tira o acesso inteiro da lista. */
export async function removerAcessoAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  try {
    const s = await equipe(slug);
    const d = await getCofre(slug);
    const cur = d.itens[id];
    if (!cur) return { ok: false, message: "Nada salvo neste item." };
    delete d.itens[id];
    d.log.push({ at: new Date().toISOString(), por: s.name, acao: "apagou", item: nomeItem(cur, id) });
    await saveCofre(slug, d);
    revalidatePath(`/cliente/${slug}/acessos`);
    return { ok: true, message: "Removido." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Não consegui remover." };
  }
}

/** Abre a senha para quem tocou no olho e registra quem viu. */
export async function verSenhaAction(slug: string, id: string): Promise<{ ok: boolean; senha?: string; message?: string }> {
  try {
    const s = await equipe(slug);
    const d = await getCofre(slug);
    const cur = d.itens[id];
    if (!cur?.senha) return { ok: false, message: "Não há senha salva." };
    const senha = decifrar(cur.senha);
    if (senha === null) return { ok: false, message: "Não consegui abrir esta senha (a chave mudou). Salve de novo." };
    d.log.push({ at: new Date().toISOString(), por: s.name, acao: "viu", item: nomeItem(cur, id) });
    await saveCofre(slug, d).catch(() => undefined);
    return { ok: true, senha };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Não consegui abrir." };
  }
}
