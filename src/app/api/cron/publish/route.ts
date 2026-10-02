import { NextResponse } from "next/server";
import { sendAlert } from "@/lib/alerts";
import { getPosts, MAX_ATTEMPTS, updatePost, type HistoryEntry } from "@/lib/content";
import { listClients } from "@/lib/clients";
import { isDue, stepPublish } from "@/lib/publish";
import { publicBase } from "@/lib/signed";
import { readDoc, storeEnabled, writeDoc } from "@/lib/store";
import { runSeedCovers, runSeedDecisions, runSeedImports } from "@/lib/seedImports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Publica os posts agendados cuja hora chegou.
 * Chamado a cada 5 min por um agendador externo gratuito (cron-job.org):
 *   GET https://members.doctorbrand.co/api/cron/publish?key=<CRON_SECRET>
 * Também aceita `Authorization: Bearer <CRON_SECRET>` (formato do Vercel Cron).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || (auth !== `Bearer ${process.env.CRON_SECRET}` && url.searchParams.get("key") !== process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!storeEnabled()) return NextResponse.json({ error: "store off" }, { status: 500 });

  // Trava simples para duas rodadas não publicarem o mesmo post.
  const lock = await readDoc<{ until?: number }>("locks/publish", {});
  if ((lock.until ?? 0) > Date.now()) return NextResponse.json({ skipped: "outra rodada em andamento" });
  await writeDoc("locks/publish", { until: Date.now() + 58_000 });

  // Planejamentos trazidos de fora (Notion) entram uma vez, como rascunho.
  const seeded: unknown[] = await runSeedImports().catch((e) => [{ key: "erro", created: 0, error: e instanceof Error ? e.message : String(e) }]);
  seeded.push(...(await runSeedCovers().catch((e) => [{ key: "capas", erro: e instanceof Error ? e.message : String(e) }])));
  seeded.push(...(await runSeedDecisions().catch((e) => [{ key: "decisoes", erro: e instanceof Error ? e.message : String(e) }])));

  const started = Date.now();
  const report: { client: string; post: string; outcome: string; message: string }[] = [];
  try {
    const clients = (await listClients()).filter((c) => c.igUserId);
    for (const c of clients) {
      const due = (await getPosts(c.slug)).filter((p) => isDue(p));
      for (const p of due) {
        const left = 52_000 - (Date.now() - started);
        if (left < 8_000) break;
        const r = await stepPublish(c, p, Math.min(40_000, left - 5_000));
        await updatePost(c.slug, p.id, (cur) => {
          const h: HistoryEntry[] = r.outcome === "published"
            ? [{ at: new Date().toISOString(), by: "Publicação automática", role: "admin", action: "publicado" }]
            : [];
          return { ...cur, status: r.post.status, publish: r.post.publish, media: r.post.media, cover: r.post.cover, history: [...cur.history, ...h] };
        });
        report.push({ client: c.slug, post: p.title, outcome: r.outcome, message: r.message });
        if (r.outcome === "published") {
          await sendAlert(`*${c.name}*: publicado no Instagram · ${p.title}${r.post.publish?.permalink ? `\n${r.post.publish.permalink}` : ""}`).catch(() => undefined);
        } else if (r.outcome === "error" && (r.post.publish?.attempts ?? 0) >= MAX_ATTEMPTS) {
          await sendAlert(`*${c.name}*: não consegui publicar "${p.title}" depois de ${MAX_ATTEMPTS} tentativas.\n${r.message}\n${publicBase()}/cliente/${c.slug}/conteudo?post=${p.id}`).catch(() => undefined);
        }
      }
    }
  } finally {
    await writeDoc("locks/publish", { until: 0 }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, ran: report.length, report, ...(seeded.length ? { seeded } : {}) });
}
