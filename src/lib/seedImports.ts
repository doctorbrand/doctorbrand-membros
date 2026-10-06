import { getPlan, getPosts, savePosts, type FeedPlan, type Media, type Post, type PostType } from "./content";
import { tarefaAlteracao } from "./alteracoesClickup";
import { put } from "@vercel/blob";
import { toJpeg } from "./drive";
import { localDir, readDoc, writeDoc } from "./store";

/**
 * Planejamentos trazidos de fora (Notion) que entram sozinhos na área do cliente, uma vez só,
 * como rascunho: a equipe revisa e envia para aprovação. Roda junto com a publicação automática.
 * Posts cujo vídeo ou arte já estiver na área do cliente não são duplicados.
 */
interface SeedPost { title: string; caption: string; date: string; time: string; media: Media[] }
interface SeedImport { key: string; slug: string; nota: string; posts: SeedPost[] }

const v = (driveId: string, name: string): Media => ({ driveId, kind: "video", name, mime: "video/mp4" });
const png = (driveId: string, name: string): Media => ({ driveId, kind: "image", name, mime: "image/png" });
const jpg = (driveId: string, name: string): Media => ({ driveId, kind: "image", name, mime: "image/jpeg" });

export const SEED_IMPORTS: SeedImport[] = [
  {
    key: "brunno-bernardo:out-nov-2026",
    slug: "brunno-bernardo",
    nota: "Trazido do Notion (Planejamento de Conteúdo OUT/NOV). Ordem conforme o grid do feed.",
    posts: [
      { title: "O que \"antes e depois\" não mostra", date: "2026-10-06", time: "12:00",
        media: [v("1Soy8tYfeP-EP6bRO9NJFDD-CjbTWteeZ", "Roteiro 07 v_1.mp4")],
        caption: "Todo mundo escolhe cirurgião pelo antes e depois. É o pior jeito possível." },
      { title: "A cirurgia começa na caneta. Não no bisturi.", date: "2026-10-08", time: "12:00",
        media: [png("1bnyLSUDB2spm9qX4Kjuis3tL-k7NaYyf", "C1.1.png"), png("1Bc_fNO3tSOiTWzN4_oBwTK8om8PmzWfV", "C1.2.png"), png("17XoI37I8bRZbLSZmnY5YFwTT5iiCYNIp", "C1.3.png"), png("1O7mUjPEFeTwhO8Kmhpst7lj5x-rktFXm", "C1.4.png"), png("1ZcRUM1bjnx2Qc3pmMnp2hqJZ7uRz2vrq", "C1.5.png")],
        caption: "A caneta não é estilo. É a primeira ferramenta que eu uso em você. Ela entra em ação antes de qualquer bisturi.\nMedir me obriga a fechar a análise antes de propor. E te dá o porquê, não só o quê." },
      { title: "Rinomodelação não diminui o nariz", date: "2026-10-10", time: "12:00",
        media: [v("1sRocZ_SXz19fmsP8pabZZwWBC2qqZsWq", "Roteiro 2 v_1.mp4")],
        caption: "Rinomodelação camufla. Quem disse que substitui a cirurgia não te explicou o procedimento direito." },
      { title: "Três erros que denunciam uma rinoplastia", date: "2026-10-13", time: "12:00",
        media: [v("1TnB1R3egE6qitJkEpH-ObVuXEmuF6y6l", "Roteiro 3 v_1.mp4")],
        caption: "O nariz não pode chamar mais atenção do que a pessoa.\nEu prefiro quando você percebe que alguém está melhor sem saber exatamente o que mudou. Esse é o objetivo aqui no consultório." },
      { title: "Eu não sou o cirurgião de todo mundo", date: "2026-10-15", time: "12:00",
        media: [png("1MY0aRHA-mvf1bH8clD_wkSO1NOc9dTEJ", "C2.1.png"), png("1cwMJZSjFFeXVp1cUOjcRAyw8dRoZXR4N", "C2.2.png"), png("1VALWyvivP__e7LxG4Dla9OLGqVItJ5Lv", "C2.3.png"), png("1lxXS42BRuamrT2AmG6zb3UW0xKiFLGpi", "C2.4.png"), png("1wVZrcggq01V5wHfHxGGJ10taMtgBDUTk", "C2.5.png"), png("1WFSR-MKvlvvOEb6vk4vNEj5DiSelg4e5", "C2.6.png")],
        caption: "Mais importante do que aparecer é fazer a pessoa certa se sentir segura no lugar certo." },
      { title: "Dia do Médico: um \"antes e depois\" que quero compartilhar", date: "2026-10-18", time: "10:00",
        // A pasta tem 11 arquivos (C3.1 a C3.11); o carrossel aceita 10, ficou de fora o C3.11.
        media: [jpg("1846ul8lVDqNVxP35kYASautMaTfPgcm6", "C3.1.jpg"), jpg("1x77MA5tqfVovuU5NVmsgP8rhwbxaeOWu", "C3.2.jpg"), jpg("1FlTBhVR9wQhkAhYDDTakvWSJdJUplSNN", "C3.3.jpg"), jpg("1p_KVB6CgfVLRZegze2PRdQeVeYa2MOUm", "C3.4.jpg"), v("1jfKwK3Mk5g7fGVkoijUDSbFOrWGKr3fM", "C3.5.mp4"), jpg("1swFck8BZ5WXx7f6HgJC2twYT8HOcTsvy", "C3.6.jpg"), v("1w9dsnFqdjSzV-PgBZTXbqmGvqAz_HNHV", "C3.7.mp4"), v("1DNh2GMucp28SGtfjfjoso9j1wzga4zgd", "C3.8.mp4"), jpg("1ngKSjKzt4vzApYNWHClwzOVXbuDhZQvI", "C3.9.jpg"), jpg("1FTxFPtFjcHvxpZCE-1E78LC2nnpjZzWC", "C3.10.jpg")],
        caption: "Hoje é Dia do Médico.\nPoder realizar sonhos e transformar vidas me deixa realizado.\nGratidão a cada paciente que confiou nos meus cuidados até aqui." },
      { title: "Se você ainda vai emagrecer, não opere agora", date: "2026-10-20", time: "12:00",
        media: [v("19W5j63RWu6g3-ZtvdZ_RxUvICXhBmyKP", "Roteiro 4 v_1.mp4")],
        caption: "Se você continuar perdendo peso depois, a flacidez que eu tratei volta." },
      { title: "É assim que eu me preparo pra operar", date: "2026-10-23", time: "12:00",
        media: [png("1Tc87TUbn4mfepzLl5Qj11waq5_cnZRQx", "C4.1.png"), png("1O7H-t2AsaxHDYAwvMy8TnxXkq_FzttJs", "C4.2.png"), png("1_99pmWSRQvtvIJT_Dv8juIaE5qio0S5r", "C4.3.png"), png("1JgytUYiel15XhNISKzJK4PV-1xUZId1E", "C4.4.png"), png("1-R_RVWOPzkvqJOKljfHki2locuu_yJaI", "C4.5.png"), png("186om0orInVeV8aZqoPqnLHRcjZEFIccT", "C4.6.png"), png("1QzaW8ePb7iw4E8b4Dj529rHz9ZIVGfv1", "C4.7.png")],
        caption: "Tem uma parte do meu trabalho que não acontece no centro cirúrgico.\nDescansar, viajar com os amigos de sempre, olhar arquitetura, fotografar o que me chama atenção, comer bem. Parece que não tem nada a ver, mas tem.\nChegar inteiro no dia da sua cirurgia é parte do que eu te devo.\nSe você quiser marcar uma avaliação, me chama no direct." },
      { title: "Atrofia mamária pós-gestacional", date: "2026-10-27", time: "12:00",
        media: [v("1ArTHsU7HtsuzVYUQYV9JHiDX6DGz18u5", "Roteiro 1 v_1.mp4")],
        caption: "Um dos efeitos da maternidade é a mudança das mamas. Se você não se sente confortável com as suas, me mande um direct. Vamos marcar sua avaliação e entender o seu caso." },
      { title: "Permita-se ser sua primeira escolha", date: "2026-10-30", time: "12:00",
        media: [v("1HpFjp8RKWmdLC2CAmz845C5fO4bkbwfk", "Roteiro 06 v_1.mp4")],
        caption: "Muitas mulheres passam a vida inteira colocando outros na frente. Se esse for o seu caso, talvez seja a hora de voltar a se olhar dentro das suas próprias escolhas." },
      { title: "Resolver tudo numa cirurgia nem sempre vale a pena", date: "2026-11-03", time: "12:00",
        media: [v("1FcfbIow5ramFKUEhXVE-7nVdywOTCJLe", "Roteiro 08 v_1.mp4")],
        caption: "Cirurgia muito prolongada, acima de seis horas, às vezes aumenta o risco. Não só o anestésico: o cirúrgico também. Quando vai chegando perto do fim, nem sempre a nossa precisão está tão alinhada quanto no início.\nPor isso eu prefiro, muitas vezes, indicar um procedimento um pouco maior numa cirurgia separada." },
      { title: "Nem toda consulta termina em cirurgia", date: "2026-11-06", time: "12:00",
        media: [v("14Pq5b2FTPKrk0s1dVxSCnv4LqJwMsaNO", "Roteiro 5 v_1.mp4")],
        caption: "Metade do meu trabalho acontece fora do centro cirúrgico." },
    ],
  },
];

const typeOf = (media: Media[]): PostType => (media.length > 1 ? "carrossel" : media[0].kind === "video" ? "reels" : "imagem");

/** Aplica os planejamentos ainda não importados (de um cliente ou de todos). Devolve o que entrou. */
export async function runSeedImports(slug?: string): Promise<{ key: string; created: number }[]> {
  const pend = SEED_IMPORTS.filter((s) => !slug || s.slug === slug);
  if (!pend.length) return [];
  const done = await readDoc<Record<string, string>>("seed-imports", {});
  if (pend.every((s) => done[s.key])) return [];
  // Trava curta: a página e a rodada automática não importam ao mesmo tempo.
  const lock = await readDoc<{ until?: number }>("locks/seed-imports", {});
  if ((lock.until ?? 0) > Date.now()) return [];
  await writeDoc("locks/seed-imports", { until: Date.now() + 30_000 });
  const out: { key: string; created: number }[] = [];
  try {
  for (const s of pend) {
    if (done[s.key]) continue;
    const posts = await getPosts(s.slug);
    const have = new Set(posts.flatMap((p) => p.media.map((m) => m.driveId).filter(Boolean)));
    const now = new Date().toISOString();
    const created: Post[] = s.posts
      .filter((p) => !p.media.some((m) => m.driveId && have.has(m.driveId)))
      .map((p) => ({
        id: crypto.randomUUID(), type: typeOf(p.media), title: p.title, caption: p.caption, media: p.media,
        date: p.date, time: p.time, status: "rascunho", createdAt: now, updatedAt: now,
        history: [{ at: now, by: "DoctorBrand", role: "admin", action: "criado", note: s.nota }],
      }));
    if (created.length) await savePosts(s.slug, [...posts, ...created]);
    done[s.key] = now;
    await writeDoc("seed-imports", done);
    out.push({ key: s.key, created: created.length });
  }
  } finally {
    await writeDoc("locks/seed-imports", { until: 0 }).catch(() => undefined);
  }
  return out;
}

/**
 * Capas dos Reels exportadas do Canva (GRID SET/OUT - Brunno Bernardo). Os links de exportação valem cerca de 1 hora:
 * o servidor baixa, guarda no Blob e coloca como capa. Se o link vencer, nada muda e a equipe sobe a capa no app.
 */
interface SeedCovers { key: string; slug: string; covers: { title: string; url: string }[] }
export const SEED_COVERS: SeedCovers[] = [
  {
    key: "brunno-bernardo:out-nov-2026:capas",
    slug: "brunno-bernardo",
    covers: [
      { title: "O que \"antes e depois\" não mostra", url: "https://export-download.canva.com/3fG_I/DAHU6_3fG_I/-1/0/0003-1354975209801100298.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261001%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261001T030831Z&X-Amz-Expires=46851&X-Amz-Signature=ab8195a3c6add568112836a9bc476817dff11de79c773eb83bd9064b9767293d&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Thu%2C%2001%20Oct%202026%2016%3A09%3A22%20GMT" },
      { title: "Rinomodelação não diminui o nariz", url: "https://export-download.canva.com/3fG_I/DAHU6_3fG_I/-1/0/0004-1354975209801100298.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20260930%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260930T153937Z&X-Amz-Expires=88605&X-Amz-Signature=fbf71019edf40eadc907e1de0f89e841ecad8abbb7f38fbeb30d93b04c09a7ad&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Thu%2C%2001%20Oct%202026%2016%3A16%3A22%20GMT" },
      { title: "Se você ainda vai emagrecer, não opere agora", url: "https://export-download.canva.com/3fG_I/DAHU6_3fG_I/-1/0/0006-1354975209801100298.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261001%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261001T084208Z&X-Amz-Expires=27876&X-Amz-Signature=f62d0720b7aa02abcb1c9286ad2befbbc9e21afa0fe96f29e979ded839309935&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Thu%2C%2001%20Oct%202026%2016%3A26%3A44%20GMT" },
      { title: "Atrofia mamária pós-gestacional", url: "https://export-download.canva.com/3fG_I/DAHU6_3fG_I/-1/0/0008-1354975209801100298.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261001%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261001T045822Z&X-Amz-Expires=41965&X-Amz-Signature=68f53e670ed277052cf1ce322498b99d89b5c0ab779a7eafcb80b84b798d47af&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Thu%2C%2001%20Oct%202026%2016%3A37%3A47%20GMT" },
      { title: "Três erros que denunciam uma rinoplastia", url: "https://export-download.canva.com/3fG_I/DAHU6_3fG_I/-1/0/0010-1354975209801100298.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261001%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261001T100059Z&X-Amz-Expires=20947&X-Amz-Signature=cecd1b9a2df1cc8723f528e0bbaf57ef18249904cbd138cc9914756f5d6b9907&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Thu%2C%2001%20Oct%202026%2015%3A50%3A06%20GMT" },
      { title: "Permita-se ser sua primeira escolha", url: "https://export-download.canva.com/3fG_I/DAHU6_3fG_I/-1/0/0011-1354975209801100298.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20260930%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260930T165856Z&X-Amz-Expires=83176&X-Amz-Signature=99ff1bcf4b37c526d161229f75e51d46d1ddf11a14ffeb044a1a86147ca0cdbd&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Thu%2C%2001%20Oct%202026%2016%3A05%3A12%20GMT" },
      { title: "Resolver tudo numa cirurgia nem sempre vale a pena", url: "https://export-download.canva.com/3fG_I/DAHU6_3fG_I/-1/0/0012-1354975209801100298.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20260930%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260930T215918Z&X-Amz-Expires=64075&X-Amz-Signature=c1643ca2ede703cfea87873ab2c930654ec456e435101bbe12f3705ae64e74cb&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Thu%2C%2001%20Oct%202026%2015%3A47%3A13%20GMT" },
      { title: "Nem toda consulta termina em cirurgia", url: "https://export-download.canva.com/3fG_I/DAHU6_3fG_I/-1/0/0013-1354975209801100298.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20260930%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260930T221332Z&X-Amz-Expires=63881&X-Amz-Signature=814a17424e92e425fe3204949a3690dad14b665c000b04ace1818735466446e4&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Thu%2C%2001%20Oct%202026%2015%3A58%3A13%20GMT" },
    ],
  },
];

async function saveCover(slug: string, postId: string, jpg: Buffer): Promise<Media> {
  const path = `content-media/${slug}/covers/canva-${postId}.jpg`;
  const dir = localDir();
  if (dir) {
    const fs = await import("fs/promises");
    await fs.mkdir(`${dir}/content-media/${slug}/covers`, { recursive: true });
    await fs.writeFile(`${dir}/${path}`, new Uint8Array(jpg));
  } else {
    await put(path, jpg, { access: "private", contentType: "image/jpeg", allowOverwrite: true, addRandomSuffix: false });
  }
  return { path, kind: "image", name: "capa.jpg", mime: "image/jpeg" };
}

/** Coloca as capas nos Reels que ainda não têm capa. Só marca como feito quando todas entraram. */
export async function runSeedCovers(slug?: string): Promise<{ key: string; covers: number; erros: string[] }[]> {
  const pend = SEED_COVERS.filter((s) => !slug || s.slug === slug);
  if (!pend.length) return [];
  const done = await readDoc<Record<string, string>>("seed-imports", {});
  const out: { key: string; covers: number; erros: string[] }[] = [];
  for (const s of pend) {
    if (done[s.key]) continue;
    const posts = await getPosts(s.slug);
    let n = 0;
    const erros: string[] = [];
    for (const c of s.covers) {
      const p = posts.find((x) => x.title === c.title && x.type === "reels");
      if (!p) { erros.push(`sem post: ${c.title}`); continue; }
      if (p.cover) { n++; continue; }
      try {
        const r = await fetch(c.url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const raw = Buffer.from(await r.arrayBuffer());
        const jpg = (r.headers.get("content-type") ?? "").includes("jpeg") ? raw : await toJpeg(raw);
        p.cover = await saveCover(s.slug, p.id, jpg);
        p.updatedAt = new Date().toISOString();
        p.history = [...p.history, { at: p.updatedAt, by: "DoctorBrand", role: "admin", action: "capa", note: "Capa do Canva (GRID SET/OUT)" }];
        n++;
      } catch (e) {
        erros.push(`${c.title}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (n) await savePosts(s.slug, posts);
    if (!erros.length) { done[s.key] = new Date().toISOString(); await writeDoc("seed-imports", done); }
    out.push({ key: s.key, covers: n, erros });
  }
  return out;
}

/**
 * Decisões que o cliente já tomou fora da área de membros (checklist de aprovação no Notion) e o pilar de cada post.
 * Aplica uma vez: pilar só onde ainda não há; status só em post que ainda está em rascunho ou aguardando;
 * legenda só se continua igual à importada. Pedido de alteração vira tarefa da Alexandra no ClickUp.
 */
type PilarKey = "autoridade" | "educa" | "prova" | "bastidor" | "convers";
interface SeedDecision { title: string; pilar: PilarKey; decisao?: "aprovado" | "alteracao"; nota?: string; legenda?: { de: string; para: string } }
interface SeedDecisions { key: string; slug: string; por: string; fonte: string; itens: SeedDecision[] }

export const SEED_DECISIONS: SeedDecisions[] = [
  {
    key: "brunno-bernardo:out-nov-2026:decisoes",
    slug: "brunno-bernardo",
    por: "Brunno Bernardo",
    fonte: "Notion (Planejamento de Conteúdo OUT/NOV)",
    itens: [
      { title: "O que \"antes e depois\" não mostra", pilar: "educa", decisao: "aprovado",
        legenda: { de: "Todo mundo escolhe cirurgião pelo antes e depois. É o pior jeito possível.", para: "Todo mundo escolhe cirurgião pelo antes e depois. Mas tem uma forma mais inteligente de fazer isso…" } },
      { title: "A cirurgia começa na caneta. Não no bisturi.", pilar: "autoridade", decisao: "aprovado" },
      { title: "Rinomodelação não diminui o nariz", pilar: "educa", decisao: "aprovado" },
      { title: "Três erros que denunciam uma rinoplastia", pilar: "educa", decisao: "aprovado" },
      { title: "Eu não sou o cirurgião de todo mundo", pilar: "autoridade", decisao: "alteracao",
        nota: "Reprovado, trocar o post. Não gostei dos temas, não gostei de tantas fotos só minhas, repetiu fotos do carrossel anterior. Não gosto de ficar falando coisas negativas (\"eu não sou\", \"não cometa esses erros\", \"se você pensou isso, pensou errado\")." },
      { title: "Dia do Médico: um \"antes e depois\" que quero compartilhar", pilar: "prova", decisao: "alteracao",
        nota: "Reprovado, trocar o post. Vou adicionar mais fotos." },
      { title: "Se você ainda vai emagrecer, não opere agora", pilar: "educa", decisao: "aprovado" },
      { title: "É assim que eu me preparo pra operar", pilar: "bastidor", decisao: "alteracao",
        nota: "Reprovado, trocar o post (sem comentário no Notion)." },
      { title: "Atrofia mamária pós-gestacional", pilar: "convers", decisao: "aprovado" },
      { title: "Permita-se ser sua primeira escolha", pilar: "convers", decisao: "aprovado" },
      { title: "Resolver tudo numa cirurgia nem sempre vale a pena", pilar: "educa" },
      { title: "Nem toda consulta termina em cirurgia", pilar: "autoridade", decisao: "aprovado" },
    ],
  },
];

const flatTxt = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Pilar com o nome que o plano do cliente usa ("Educação", "Educativo"…); sem correspondência, fica sem pilar. */
function pilarDoPlano(plan: FeedPlan, k: PilarKey): string | undefined {
  return plan.pillars.find((p) => flatTxt(p.name).includes(k))?.name;
}

export async function runSeedDecisions(slug?: string): Promise<{ key: string; pilares: number; aprovados: number; alteracoes: number; tarefas: string[]; erros: string[] }[]> {
  const pend = SEED_DECISIONS.filter((s) => !slug || s.slug === slug);
  if (!pend.length) return [];
  const done = await readDoc<Record<string, string>>("seed-imports", {});
  if (pend.every((s) => done[s.key])) return [];
  const lock = await readDoc<{ until?: number }>("locks/seed-decisoes", {});
  if ((lock.until ?? 0) > Date.now()) return [];
  await writeDoc("locks/seed-decisoes", { until: Date.now() + 60_000 });
  const out: { key: string; pilares: number; aprovados: number; alteracoes: number; tarefas: string[]; erros: string[] }[] = [];
  try {
    for (const s of pend) {
      if (done[s.key]) continue;
      const [posts, plan] = await Promise.all([getPosts(s.slug), getPlan(s.slug)]);
      const erros: string[] = [];
      const pedidos: { post: Post; nota: string }[] = [];
      let pilares = 0, aprovados = 0;
      const now = new Date().toISOString();
      for (const it of s.itens) {
        const p = posts.find((x) => x.title === it.title);
        if (!p) { erros.push(`sem post: ${it.title}`); continue; }
        const hist = [...p.history];
        const pillar = pilarDoPlano(plan, it.pilar);
        let mudou = false;
        if (!p.pillar && pillar) { p.pillar = pillar; pilares++; mudou = true; }
        let legendaNova = false;
        if (it.legenda && p.caption === it.legenda.de) { p.caption = it.legenda.para; legendaNova = true; mudou = true; }
        if (it.decisao && (p.status === "rascunho" || p.status === "aguardando")) {
          if (legendaNova) hist.push({ at: now, by: "DoctorBrand", role: "admin", action: "editado", note: `Legenda igual à versão aprovada no ${s.fonte}` });
          if (it.decisao === "aprovado") {
            hist.push({ at: now, by: s.por, role: "cliente", action: "aprovado", note: `Aprovado pelo cliente no ${s.fonte}` });
            p.status = "aprovado";
            aprovados++;
          } else {
            const nota = it.nota ?? "Pedido de alteração registrado no Notion.";
            hist.push({ at: now, by: s.por, role: "cliente", action: "alteracao", note: `${nota} (registrado no ${s.fonte})` });
            p.status = "alteracao";
            pedidos.push({ post: p, nota });
          }
        }
        if (mudou || hist.length !== p.history.length) { p.history = hist; p.updatedAt = now; }
      }
      await savePosts(s.slug, posts);
      // Marca antes das tarefas: uma segunda rodada não cria tarefa repetida no ClickUp.
      if (!erros.length) { done[s.key] = now; await writeDoc("seed-imports", done); }
      const tarefas: string[] = [];
      for (const r of pedidos) {
        const t = await tarefaAlteracao(s.slug, r.post, { by: `${s.por} (pelo Notion)`, note: r.nota });
        tarefas.push(t.ok ? t.url : `erro: ${t.error}`);
      }
      out.push({ key: s.key, pilares, aprovados, alteracoes: pedidos.length, tarefas, erros });
    }
  } finally {
    await writeDoc("locks/seed-decisoes", { until: 0 }).catch(() => undefined);
  }
  return out;
}

/** Link do Drive de cada post (do planejamento no Notion), para "Atualizar do Drive". Só preenche onde não há link. */
const F = (id: string) => `https://drive.google.com/drive/folders/${id}`;
const A = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const SEED_SOURCES: { key: string; slug: string; links: Record<string, string> }[] = [
  {
    key: "brunno-bernardo:out-nov-2026:links",
    slug: "brunno-bernardo",
    links: {
      "O que \"antes e depois\" não mostra": A("1Soy8tYfeP-EP6bRO9NJFDD-CjbTWteeZ"),
      "A cirurgia começa na caneta. Não no bisturi.": F("11D1c_XNc744f43V32XBHXOxLrvokcehE"),
      "Rinomodelação não diminui o nariz": A("1sRocZ_SXz19fmsP8pabZZwWBC2qqZsWq"),
      "Três erros que denunciam uma rinoplastia": A("1TnB1R3egE6qitJkEpH-ObVuXEmuF6y6l"),
      "Eu não sou o cirurgião de todo mundo": F("1lEsc9JhystoHFFZ-dM88lU46u8ZtQGRh"),
      "Dia do Médico: um \"antes e depois\" que quero compartilhar": F("1u9e502hVLCW1nhbxVF_4G1Xe1D0lLz0u"),
      "Se você ainda vai emagrecer, não opere agora": A("19W5j63RWu6g3-ZtvdZ_RxUvICXhBmyKP"),
      "É assim que eu me preparo pra operar": F("1tF-rCfmk9_v9ZY1lXsSSyQdENvqr34a-"),
      "Atrofia mamária pós-gestacional": A("1ArTHsU7HtsuzVYUQYV9JHiDX6DGz18u5"),
      "Permita-se ser sua primeira escolha": A("1HpFjp8RKWmdLC2CAmz845C5fO4bkbwfk"),
      "Resolver tudo numa cirurgia nem sempre vale a pena": A("1FcfbIow5ramFKUEhXVE-7nVdywOTCJLe"),
      "Nem toda consulta termina em cirurgia": A("14Pq5b2FTPKrk0s1dVxSCnv4LqJwMsaNO"),
    },
  },
];

export async function runSeedSources(slug?: string): Promise<{ key: string; links: number }[]> {
  const pend = SEED_SOURCES.filter((s) => !slug || s.slug === slug);
  if (!pend.length) return [];
  const done = await readDoc<Record<string, string>>("seed-imports", {});
  const out: { key: string; links: number }[] = [];
  for (const s of pend) {
    if (done[s.key]) continue;
    const posts = await getPosts(s.slug);
    let n = 0;
    for (const p of posts) {
      const link = s.links[p.title];
      if (link && !p.source) { p.source = link; n++; }
    }
    if (n) await savePosts(s.slug, posts);
    done[s.key] = new Date().toISOString();
    await writeDoc("seed-imports", done);
    out.push({ key: s.key, links: n });
  }
  return out;
}
