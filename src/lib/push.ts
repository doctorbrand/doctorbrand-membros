import webpush from "web-push";
import { getUsers, type User } from "./users";
import { readDoc, writeDoc } from "./store";

/**
 * Notificações no celular (Web Push), de graça: o envio passa pelos serviços da Apple e do Google.
 * Chaves na Vercel: VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY. Sem elas, nada aparece e nada é enviado.
 * Cada usuário tem um documento push/<id> com os aparelhos inscritos e o que quer receber.
 */

export const TIPOS = {
  aprovacao: { label: "Posts para aprovar", dica: "Quando a equipe envia posts e um lembrete por dia se ficarem parados.", para: "cliente" },
  publicado: { label: "Post publicado", dica: "Quando um post vai ao ar no Instagram.", para: "cliente" },
  resultado: { label: "Resultado do post", dica: "Alcance e salvamentos dois dias depois de publicar.", para: "cliente" },
  semana: { label: "Resumo da semana", dica: "Toda segunda, o que saiu e quanto alcançou.", para: "cliente" },
  reuniao: { label: "Reunião amanhã", dica: "Na véspera, com o horário.", para: "cliente" },
  relatorio: { label: "Relatório do mês", dica: "Quando o relatório do mês anterior fica pronto.", para: "cliente" },
  equipe: { label: "Aprovações e pedidos dos clientes", dica: "Quando um cliente aprova, pede alteração ou agenda.", para: "admin" },
} as const;
export type TipoPush = keyof typeof TIPOS;

export interface Inscricao { endpoint: string; keys: { p256dh: string; auth: string }; criadoEm: string; aparelho?: string }
export interface PushDoc { subs: Inscricao[]; prefs: Partial<Record<TipoPush, boolean>> }

export const vapidPublica = () => process.env.VAPID_PUBLIC_KEY ?? "";
export const pushLigado = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

const docPath = (userId: string) => `push/${userId}`;
export const getPushDoc = (userId: string) => readDoc<PushDoc>(docPath(userId), { subs: [], prefs: {} });
export const savePushDoc = (userId: string, d: PushDoc) => writeDoc(docPath(userId), d);

export const quer = (d: PushDoc, tipo: TipoPush) => d.prefs[tipo] !== false;

/** Hora em Brasília (0 a 23). */
export function horaBR(d = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(d));
}
/** Sem notificação entre 21h e 8h. */
export const horarioOk = (d = new Date()) => { const h = horaBR(d); return h >= 8 && h < 21; };

export interface Aviso { title: string; body: string; url: string; tag?: string }

let configurado = false;
function configurar() {
  if (configurado) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://members.doctorbrand.co", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configurado = true;
}

/** Envia para todos os aparelhos de um usuário que aceitam este tipo. Tira da lista os aparelhos que saíram. */
export async function enviarParaUsuario(userId: string, tipo: TipoPush | "teste", aviso: Aviso): Promise<number> {
  if (!pushLigado()) return 0;
  const d = await getPushDoc(userId);
  if (!d.subs.length || (tipo !== "teste" && !quer(d, tipo))) return 0;
  configurar();
  const payload = JSON.stringify(aviso);
  const mortos: string[] = [];
  let enviados = 0;
  await Promise.all(d.subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 12 * 3600, urgency: "normal" });
      enviados++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) mortos.push(s.endpoint);
    }
  }));
  if (mortos.length) await savePushDoc(userId, { ...d, subs: d.subs.filter((s) => !mortos.includes(s.endpoint)) }).catch(() => undefined);
  return enviados;
}

async function enviarPara(users: User[], tipo: TipoPush, aviso: Aviso): Promise<number> {
  let n = 0;
  for (const u of users) n += await enviarParaUsuario(u.id, tipo, aviso).catch(() => 0);
  return n;
}

/** Para os acessos do cliente (cada médico pode ter mais de um login: ele, a secretária). */
export async function avisarCliente(slug: string, tipo: TipoPush, aviso: Aviso): Promise<number> {
  if (!pushLigado()) return 0;
  return enviarPara((await getUsers()).filter((u) => u.role === "cliente" && u.clientSlug === slug), tipo, aviso);
}

/** Para a equipe. Fora do horário, não envia (o Telegram continua avisando). */
export async function avisarEquipe(aviso: Aviso): Promise<number> {
  if (!pushLigado() || !horarioOk()) return 0;
  return enviarPara((await getUsers()).filter((u) => u.role === "admin"), "equipe", aviso);
}
