import { getPosts, savePosts, type Media, type Post, type PostType } from "./content";
import { readDoc, writeDoc } from "./store";

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

/** Aplica os planejamentos ainda não importados. Devolve o que entrou. */
export async function runSeedImports(): Promise<{ key: string; created: number }[]> {
  const done = await readDoc<Record<string, string>>("seed-imports", {});
  const out: { key: string; created: number }[] = [];
  for (const s of SEED_IMPORTS) {
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
  return out;
}
