import type { WorkCat, WorkSummary } from "./clickup";
import type { MetaKR, Metas } from "./project";

/** Método D.O.M.Í.N.I.O.: as 7 etapas que o cliente vai conquistando. */
export const METODO: { letra: string; nome: string; texto: string }[] = [
  { letra: "D", nome: "Direção", texto: "Objetivos, público e o lugar que a sua marca vai ocupar." },
  { letra: "O", nome: "Organização", texto: "Acessos, rotina de aprovação e o processo rodando." },
  { letra: "M", nome: "Mensagem", texto: "Narrativa, tom de voz e o que só você pode dizer." },
  { letra: "Í", nome: "Imagem", texto: "Identidade visual, fotos e captação audiovisual." },
  { letra: "N", nome: "Nutrição", texto: "Conteúdo recorrente que educa e gera confiança." },
  { letra: "I", nome: "Influência", texto: "Alcance, anúncios e autoridade fora do seu perfil." },
  { letra: "O", nome: "Operação", texto: "Contatos viram consultas: atendimento e conversão." },
];

// ─── Trimestre ────────────────────────────────────────────────────────

export function quarterOf(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-T${Math.ceil(m / 3)}`;
}

export function quarterMonths(q: string): string[] {
  const [y, t] = q.split("-T").map(Number);
  return [1, 2, 3].map((i) => `${y}-${String((t - 1) * 3 + i).padStart(2, "0")}`);
}

export function quarterLabel(q: string): string {
  const [y, t] = q.split("-T");
  return `${t}º trimestre de ${y}`;
}

export interface KrContext { entregas: number | null; posts: number; contatos: number | null }

/** Valor atual de uma meta: o que a equipe marcou ou o que vem sozinho (ClickUp, feed, anúncios). */
export function krValue(kr: MetaKR, ctx: KrContext): number | null {
  if (kr.fonte === "entregas") return ctx.entregas;
  if (kr.fonte === "posts") return ctx.posts;
  if (kr.fonte === "contatos") return ctx.contatos;
  return kr.atual;
}

export function metasDone(m: Metas | undefined, ctx: KrContext): boolean {
  return !!m && m.krs.length > 0 && m.krs.every((k) => (krValue(k, ctx) ?? 0) >= k.alvo);
}

// ─── Conquistas ───────────────────────────────────────────────────────

export interface Badge { id: string; title: string; text: string; value: number; target: number; earned: boolean }

interface BadgeInput { work: WorkSummary | null; etapa: number; metasBatidas: boolean; contatosTotal: number | null; today: string }

const cat = (w: WorkSummary | null, c: WorkCat) => w?.byCat.find((x) => x.cat === c)?.count ?? 0;

function days(from: string | null, to: string): number {
  if (!from) return 0;
  return Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400e3);
}

/**
 * Selos em trilhas: de cada trilha aparece o maior selo conquistado e o próximo a conquistar.
 * Tudo é calculado; a equipe não precisa marcar nada.
 */
export function badges(i: BadgeInput): Badge[] {
  const tracks: { id: string; value: number; tiers: { target: number; title: string; text: string }[] }[] = [
    { id: "entregas", value: i.work?.done ?? 0, tiers: [
      { target: 1, title: "Primeira entrega", text: "O projeto saiu do papel." },
      { target: 25, title: "25 entregas", text: "Ritmo de marca que aparece." },
      { target: 50, title: "50 entregas", text: "Consistência que o algoritmo e o paciente notam." },
      { target: 100, title: "100 entregas", text: "Um acervo que trabalha por você." },
      { target: 250, title: "250 entregas", text: "Poucas marcas médicas chegam aqui." },
    ] },
    { id: "roteiros", value: cat(i.work, "roteiro"), tiers: [
      { target: 10, title: "10 roteiros", text: "Sua forma de explicar, registrada." },
      { target: 25, title: "25 roteiros", text: "Um repertório autoral." },
      { target: 50, title: "50 roteiros", text: "Uma biblioteca de autoridade." },
    ] },
    { id: "captacoes", value: cat(i.work, "captacao"), tiers: [
      { target: 1, title: "Primeira captação", text: "Sua imagem, do seu jeito." },
      { target: 3, title: "3 captações", text: "Acervo audiovisual em construção." },
      { target: 6, title: "6 captações", text: "Presença em vídeo consolidada." },
    ] },
    { id: "tempo", value: days(i.work?.since ?? null, i.today), tiers: [
      { target: 90, title: "3 meses de projeto", text: "O ciclo completo rodando." },
      { target: 180, title: "6 meses de projeto", text: "Marca em construção contínua." },
      { target: 365, title: "1 ano de projeto", text: "Um ano construindo autoridade." },
      { target: 730, title: "2 anos de projeto", text: "Parceria de longo prazo." },
    ] },
    { id: "metodo", value: i.etapa + 1, tiers: [
      { target: 3, title: "Mensagem definida", text: "Você sabe o que dizer e como dizer." },
      { target: 5, title: "Nutrição ativa", text: "Conteúdo que educa toda semana." },
      { target: 7, title: "Método completo", text: "As 7 etapas do D.O.M.Í.N.I.O. conquistadas." },
    ] },
  ];
  if (i.contatosTotal !== null) tracks.push({ id: "contatos", value: i.contatosTotal, tiers: [
    { target: 1, title: "Primeiro contato", text: "Os anúncios trouxeram o primeiro paciente em potencial." },
    { target: 100, title: "100 contatos", text: "Demanda que chega pelo digital." },
    { target: 500, title: "500 contatos", text: "Uma máquina de demanda." },
  ] });

  const out: Badge[] = [];
  for (const t of tracks) {
    const earned = t.tiers.filter((x) => t.value >= x.target);
    const next = t.tiers.find((x) => t.value < x.target);
    const top = earned.at(-1);
    if (top) out.push({ id: `${t.id}-${top.target}`, ...top, value: t.value, earned: true });
    if (next) out.push({ id: `${t.id}-${next.target}`, ...next, value: t.value, earned: false });
  }
  out.push({ id: "metas", title: "Metas do trimestre batidas", text: "Todas as metas do trimestre alcançadas.", value: i.metasBatidas ? 1 : 0, target: 1, earned: i.metasBatidas });
  return out.sort((a, b) => Number(b.earned) - Number(a.earned) || b.value / b.target - a.value / a.target);
}
