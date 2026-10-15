import Link from "next/link";
import { notFound } from "next/navigation";
import { CarouselStudio } from "@/components/carousel/CarouselStudio";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/brandStore";
import { claudeOn } from "@/lib/claudeGen";
import { getClient } from "@/lib/clients";
import { todayISO } from "@/lib/periods";
import { previewDocAction, saveDocAction, writeWithClaudeAction } from "./actions";
import { getPosts } from "@/lib/content";
import { driveFolderFiles, parseDriveLinks } from "@/lib/drive";
import { googleFontCss } from "@/lib/brand";
import { localDir } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Primeiro carrossel do piloto (perfil do Fernando), a partir do roteiro "A paciente que nunca curtiu". */
const PILOTO: Record<string, { text: string; caption: string }> = {
  "fernando-fontes": {
    text: [
      "# A paciente que vai pagar sua cirurgia mais cara *nunca curtiu* um post seu.\nE mesmo assim ela já decidiu muita coisa sobre você.",
      "# Vinte curtidas não dizem nada.\nTrês comentários da sua tia também não. Ela está lá. Só não aparece.",
      "# Ela não curte. Não comenta. Não segue.\nAssiste calada, salva e manda para uma amiga.",
      "# Semanas depois, chega dizendo *“te acompanho faz tempo”*.\nE você nunca viu o nome dela em lugar nenhum.",
      "# Ela não chega para ser convencida.\nChega para *confirmar* se o que viu no seu perfil se sustenta na consulta.",
      "# Então mude a régua.\nNão meça o perfil pela curtida de quem nunca vai operar. Se ela abrisse hoje, ia *confirmar ou desistir*?",
      "# Comenta *ANALISE*\nEu olho seu perfil e te digo o que essa paciente encontra quando entra.",
    ].join("\n---\n"),
    caption: "A paciente de alto valor não curte, não comenta, não segue.\nEla assiste, salva e manda para quem confia.\nQuando chega na clínica, não vem para ser convencida. Vem confirmar.\nComenta ANALISE que eu te digo o que ela encontra no seu perfil.",
  },
};

export default async function CarrosselPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ post?: string }> }) {
  const { slug } = await params;
  const { post: postId } = await searchParams;
  const session = await requireAdmin();
  const c = await getClient(slug);
  if (!c) notFound();
  const [kit, posts] = await Promise.all([getBrand(slug), postId ? getPosts(slug) : Promise.resolve([])]);
  const templates = kit.templates ?? [];
  const editing = postId ? posts.find((p) => p.id === postId && p.carrossel) : undefined;
  const folder = kit.driveFolder ? parseDriveLinks(kit.driveFolder).folders[0] : undefined;
  const pool = folder ? (await driveFolderFiles(folder).catch(() => [])).filter((f) => f.mime.startsWith("image/")).map((f) => f.id) : [];
  const url = (p?: string) => (p ? `/api/media?p=${encodeURIComponent(p)}` : undefined);
  const logos = { principal: url(kit.logos.principal?.path), claro: url(kit.logos.claro?.path), escuro: url(kit.logos.escuro?.path) };
  const piloto = PILOTO[slug];

  return (
    <Shell active="marca" session={session} clientSlug={slug}>
      <FontLinks kit={kit} />
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="label">{c.name} · {c.specialty}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">{editing ? "Editar carrossel" : "Montar carrossel"}</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">{editing ? `Post “${editing.title}”. Troque textos e fotos, ajuste letras e posições e atualize os slides.` : "Escolha um modelo, escreva os slides (ou peça ao Claude) e ajuste cada slide no editor. Os slides saem em JPG 1080 × 1350, prontos para aprovação e publicação."}</p>
        </div>
        <Link href={`/cliente/${slug}/marca`} className="ct-btn">Kit de marca</Link>
      </div>
      {postId && !editing && <section className="card p-5 text-sm mb-4 g-bad">Esse post não foi montado aqui (ou não existe mais). Comece um carrossel novo abaixo.</section>}
      {templates.length === 0 ? (
        <section className="card p-5 text-sm">Este cliente ainda não tem modelos de carrossel. <Link href={`/cliente/${slug}/marca`} className="underline">Crie os modelos no Kit de marca</Link>.</section>
      ) : (
        <CarouselStudio slug={slug} kit={kit} templates={templates} pool={pool} logos={logos} local={!!localDir()} claude={claudeOn()}
          initialDoc={editing?.carrossel} postId={editing?.id}
          initialText={editing ? "" : piloto?.text ?? ""} initialCaption={editing?.caption ?? piloto?.caption ?? ""}
          defaultDate={editing?.date ?? todayISO()} defaultTime={editing?.time ?? "12:00"}
          write={writeWithClaudeAction} preview={previewDocAction} save={saveDocAction} />
      )}
    </Shell>
  );
}

/** Fontes do kit no editor (a prévia em HTML usa a fonte real; o JPG carrega à parte). */
function FontLinks({ kit }: { kit: Awaited<ReturnType<typeof getBrand>> }) {
  const fs = [kit.fonts.titulo, kit.fonts.texto].filter((f) => f?.family);
  return (
    <>
      {fs.filter((f) => f!.source === "google").map((f) => <link key={f!.family} rel="stylesheet" href={googleFontCss(f!.family, f!.weight)} precedence="default" />)}
      {fs.some((f) => f!.source === "arquivo" && f!.path) && <style>{fs.filter((f) => f!.source === "arquivo" && f!.path).map((f) => `@font-face{font-family:"${f!.family.replace(/"/g, "")}";src:url("/api/media?p=${encodeURIComponent(f!.path!)}");font-display:swap}`).join("\n")}</style>}
    </>
  );
}
