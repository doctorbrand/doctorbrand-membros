import { scanCfmText } from "./cfm";
import { plannedAt, scheduleOrder, TYPE_LABEL, type FeedPlan, type Post, type PostType } from "./content";
import { normalize } from "./tags";

/**
 * Pontuação do planejamento do feed (0–100) contra as metas do cliente. Determinística, sem IA:
 * frequência, mix de formatos, pilares, qualidade das legendas, CFM e ritmo do grid.
 */

export interface ScoreItem { key: string; label: string; score: number; max: number; detail: string; tips: string[] }
export interface FeedScore { total: number; grade: "A" | "B" | "C" | "D"; gradeLabel: string; window: string; count: number; items: ScoreItem[] }
export interface PostCheck { ok: boolean; label: string; severity?: "alta" | "cinza" }

const CTA = /AGEND|LINK NA BIO|COMENT|\bSALV[AEO]|COMPARTILH|ENVI[AE]|DIRECT|\bDM\b|WHATSAPP|MARQUE|CLIQUE|ME CONTA|CONTA PRA|MANDA|RESPONDA|ARRASTA/;
const TRIO: Record<PostType, string> = { imagem: "3 fotos únicas seguidas", carrossel: "3 carrosséis seguidos", reels: "3 Reels seguidos" };
const hashtags = (c: string) => (c.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
const firstLine = (c: string) => c.split(/\r?\n/).find((l) => l.trim())?.trim() ?? "";
const body = (c: string) => c.replace(/#[\p{L}\p{N}_]+/gu, "").trim();

export function postChecks(p: Post, plan: FeedPlan): PostCheck[] {
  const c = p.caption ?? "";
  const n = normalize(c);
  const fl = firstLine(c);
  const tags = hashtags(c);
  const out: PostCheck[] = [
    { ok: fl.length > 0 && fl.length <= 125, label: fl.length > 125 ? `Primeira linha com ${fl.length} caracteres: o Instagram corta em ~125. Encurte o gancho.` : fl.length === 0 ? "Sem primeira linha (gancho)." : "Gancho cabe antes do “mais”." },
    { ok: CTA.test(n), label: CTA.test(n) ? "Tem chamada para ação." : "Sem chamada para ação (agende, comente, salve, link na bio…)." },
    { ok: tags <= plan.hashtagsMax, label: tags <= plan.hashtagsMax ? `${tags} hashtag${tags === 1 ? "" : "s"} (meta: até ${plan.hashtagsMax}).` : `${tags} hashtags: acima da meta de ${plan.hashtagsMax}.` },
    { ok: body(c).length >= 80, label: body(c).length >= 80 ? "Legenda com conteúdo suficiente." : "Legenda curta demais (menos de 80 caracteres sem hashtags)." },
    { ok: !!p.pillar, label: p.pillar ? `Pilar: ${p.pillar}.` : "Sem pilar editorial definido." },
  ];
  if (p.type === "reels") out.push({ ok: !!p.cover, label: p.cover ? "Capa escolhida." : "Reels sem capa escolhida: o Instagram usa o primeiro frame." });
  for (const h of scanCfmText(c)) out.push({ ok: false, severity: h.severity, label: `${h.severity === "alta" ? "CFM" : "CFM (atenção)"}: ${h.rule.replace(/^CFM-\d+(\/\d+)? /, "")} (“${h.match.toLowerCase()}”).` });
  return out;
}

/** Distância entre duas distribuições em % (0 = igual, 100 = oposta). */
function distance(actual: Record<string, number>, target: Record<string, number>): number {
  const keys = new Set([...Object.keys(actual), ...Object.keys(target)]);
  let d = 0;
  for (const k of keys) d += Math.abs((actual[k] ?? 0) - (target[k] ?? 0));
  return d / 2;
}

const pct = (counts: Record<string, number>, n: number) => Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, n ? (v / n) * 100 : 0]));
const round = (x: number) => Math.round(x * 10) / 10;

export function scoreFeed(all: Post[], plan: FeedPlan, today: string): FeedScore {
  const start = new Date(`${today}T00:00:00-03:00`).getTime();
  const end = start + 28 * 86400_000;
  const planned = all.filter((p) => p.status !== "publicado");
  let posts = scheduleOrder(planned.filter((p) => { const t = plannedAt(p).getTime(); return t >= start && t < end; }));
  let window = "próximas 4 semanas";
  if (posts.length === 0 && planned.length) { posts = scheduleOrder(planned); window = "todo o planejamento"; }
  const n = posts.length;
  const items: ScoreItem[] = [];

  // 1. Frequência
  const target = plan.postsPerWeek * 4;
  const freq = 25 * Math.min(1, n / Math.max(1, target));
  items.push({ key: "freq", label: "Frequência", score: round(freq), max: 25, detail: `${n} de ${target} posts nas ${window} (meta: ${plan.postsPerWeek} por semana).`,
    tips: n < target ? [`Faltam ${target - n} post${target - n > 1 ? "s" : ""} para bater a meta.`] : [] });

  // 2. Formatos
  const byType: Record<PostType, number> = { reels: 0, carrossel: 0, imagem: 0 };
  posts.forEach((p) => { byType[p.type]++; });
  const typePct = pct(byType, n);
  const dType = n ? distance(typePct, plan.mix) : 100;
  const typeTips = (Object.keys(plan.mix) as PostType[]).filter((t) => Math.abs((typePct[t] ?? 0) - plan.mix[t]) >= 15)
    .map((t) => `${TYPE_LABEL[t]}: ${Math.round(typePct[t] ?? 0)}% (meta ${plan.mix[t]}%).`);
  items.push({ key: "mix", label: "Mix de formatos", score: round(20 * (1 - dType / 100)), max: 20,
    detail: (Object.keys(byType) as PostType[]).map((t) => `${TYPE_LABEL[t]} ${byType[t]}`).join(" · "), tips: typeTips });

  // 3. Pilares
  if (plan.pillars.length) {
    const byPillar: Record<string, number> = {};
    posts.forEach((p) => { const k = p.pillar && plan.pillars.some((x) => x.name === p.pillar) ? p.pillar : "Sem pilar"; byPillar[k] = (byPillar[k] ?? 0) + 1; });
    const pPct = pct(byPillar, n);
    const tgt = Object.fromEntries(plan.pillars.map((p) => [p.name, p.target]));
    let streaks = 0;
    for (let i = 2; i < posts.length; i++) if (posts[i].pillar && posts[i].pillar === posts[i - 1].pillar && posts[i].pillar === posts[i - 2].pillar) streaks++;
    const s = Math.max(0, 20 * (1 - (n ? distance(pPct, tgt) : 100) / 100) - streaks * 2);
    const tips = plan.pillars.filter((p) => Math.abs((pPct[p.name] ?? 0) - p.target) >= 15).map((p) => `${p.name}: ${Math.round(pPct[p.name] ?? 0)}% (meta ${p.target}%).`);
    if (byPillar["Sem pilar"]) tips.unshift(`${byPillar["Sem pilar"]} post${byPillar["Sem pilar"] > 1 ? "s" : ""} sem pilar.`);
    if (streaks) tips.push(`${streaks}× o mesmo pilar 3 vezes seguidas: alterne.`);
    items.push({ key: "pillars", label: "Pilares editoriais", score: round(s), max: 20, detail: plan.pillars.map((p) => `${p.name} ${byPillar[p.name] ?? 0}`).join(" · "), tips });
  } else {
    items.push({ key: "pillars", label: "Pilares editoriais", score: 20, max: 20, detail: "Sem metas de pilar definidas.", tips: ["Defina os pilares do cliente nas metas."] });
  }

  // 4. Legendas
  const capChecks = posts.map((p) => postChecks(p, plan).slice(0, 4));
  const capScore = n ? capChecks.reduce((a, cs) => a + cs.filter((c) => c.ok).length / cs.length, 0) / n : 0;
  const noCta = capChecks.filter((cs) => !cs[1].ok).length;
  const longHook = capChecks.filter((cs) => !cs[0].ok).length;
  const manyTags = capChecks.filter((cs) => !cs[2].ok).length;
  items.push({ key: "captions", label: "Qualidade das legendas", score: round(15 * capScore), max: 15, detail: `Gancho, chamada para ação, hashtags e corpo em ${n} legendas.`,
    tips: [noCta && `${noCta} sem chamada para ação.`, longHook && `${longHook} com gancho longo demais.`, manyTags && `${manyTags} com hashtags acima da meta.`].filter(Boolean) as string[] });

  // 5. CFM
  const hits = posts.flatMap((p) => scanCfmText(p.caption).map((h) => ({ ...h, title: p.title })));
  const altas = new Set(hits.filter((h) => h.severity === "alta").map((h) => h.title));
  const cinza = hits.filter((h) => h.severity === "cinza").length;
  items.push({ key: "cfm", label: "Conformidade CFM", score: Math.max(0, 10 - altas.size * 5 - cinza), max: 10,
    detail: hits.length ? `${altas.size} post${altas.size === 1 ? "" : "s"} com termo proibido, ${cinza} ponto${cinza === 1 ? "" : "s"} de atenção.` : "Nenhum termo sensível nas legendas.",
    tips: hits.slice(0, 4).map((h) => `“${h.title}”: ${h.match.toLowerCase()}.`) });

  // 6. Ritmo do grid
  let pen = 0;
  const rhythm: string[] = [];
  for (let i = 2; i < posts.length; i++) if (posts[i].type === posts[i - 1].type && posts[i].type === posts[i - 2].type) { pen += 3; rhythm.push(`${TRIO[posts[i].type]} até “${posts[i].title}”.`); }
  const maxGap = Math.max(3, Math.ceil((7 / Math.max(1, plan.postsPerWeek)) * 2));
  for (let i = 1; i < posts.length; i++) {
    const gap = (plannedAt(posts[i]).getTime() - plannedAt(posts[i - 1]).getTime()) / 86400_000;
    if (gap > maxGap) { pen += 2; rhythm.push(`${Math.round(gap)} dias sem post antes de “${posts[i].title}”.`); }
    if (posts[i].date === posts[i - 1].date) { pen += 2; rhythm.push(`Dois posts no mesmo dia (${posts[i].date.split("-").reverse().join("/")}).`); }
  }
  items.push({ key: "rhythm", label: "Ritmo do grid", score: n ? Math.max(0, 10 - pen) : 0, max: 10, detail: n ? "Alternância de formatos e intervalo entre posts." : "Sem posts planejados.", tips: rhythm.slice(0, 4) });

  const total = Math.round(items.reduce((a, i) => a + i.score, 0));
  const grade = total >= 85 ? "A" : total >= 70 ? "B" : total >= 50 ? "C" : "D";
  const gradeLabel = { A: "Excelente", B: "Bom", C: "Atenção", D: "Precisa de ajustes" }[grade];
  return { total, grade, gradeLabel, window, count: n, items };
}
