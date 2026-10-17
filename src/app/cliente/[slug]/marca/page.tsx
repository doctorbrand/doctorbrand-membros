import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ArrowUpRightIcon, CheckIcon, FolderIcon } from "@/components/Icons";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/brandStore";
import { brandChecklist, MAX_MODELOS, modelosDoKit } from "@/lib/brand";
import { studioHref } from "@/lib/studio";
import { getClient } from "@/lib/clients";
import { getPlan, getPosts, monthlyByType } from "@/lib/content";
import { DRIVE_WEB, mediaUrl } from "@/lib/content-media";
import { driveFolderFiles, parseDriveLinks } from "@/lib/drive";
import { saveBrandAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function DrivePhotos({ link }: { link: string }) {
  const id = parseDriveLinks(link).folders[0];
  if (!id) return null;
  let files: { id: string; name: string }[];
  try {
    files = (await driveFolderFiles(id)).filter((f) => f.mime.startsWith("image/"));
  } catch (e) {
    return <p className="text-sm g-bad">{e instanceof Error ? e.message : "Não consegui ler a pasta."}</p>;
  }
  if (files.length === 0) return <p className="text-sm text-[var(--muted)]">A pasta abriu, mas não tem fotos soltas (subpastas não entram na contagem).</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-[var(--muted)]">{files.length} {files.length === 1 ? "foto" : "fotos"} na pasta.</p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {files.slice(0, 12).map((f) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f.id} src={mediaUrl({ driveId: f.id, kind: "image" }, 240)} alt={f.name} title={f.name} loading="lazy" className="aspect-square w-full object-cover rounded-lg border border-[var(--line)]" />
        ))}
      </div>
    </div>
  );
}

export default async function MarcaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireAdmin();
  const c = await getClient(slug);
  if (!c) notFound();
  const [k, plan, posts] = await Promise.all([getBrand(slug), getPlan(slug), getPosts(slug)]);
  const meta = monthlyByType(plan).carrossel;
  const mes = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const feitos = posts.filter((p) => p.type === "carrossel" && p.date?.startsWith(mes)).length;
  const checks = brandChecklist(k);
  const modelos = modelosDoKit(k);
  // Linhas do formulário: os modelos que existem e mais duas em branco (até o máximo).
  const linhas = [...modelos, ...Array.from({ length: Math.max(0, Math.min(MAX_MODELOS, modelos.length + 2) - modelos.length) }, () => ({ nome: "", link: "" }))];
  const done = checks.filter((x) => x.done).length;

  return (
    <Shell active="marca" session={session} clientSlug={slug}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="label">{c.name} · {c.specialty}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Kit de marca</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">O desenho dos carrosséis fica no Canva: aqui ficam os modelos e a pasta do cliente no Canva, o tom de voz e a pasta de fotos. O Estúdio de Carrosséis lê tudo daqui. Só a equipe vê esta página.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`pill ${done === checks.length ? "pill-green" : done >= 2 ? "pill-info" : "pill-yellow"}`}>{done} de {checks.length} prontos</span>
          <Link href={`/cliente/${slug}/perfil`} className="ct-btn">Perfil</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {checks.map((x) => <span key={x.label} className={`pill ${x.done ? "pill-green" : ""}`}>{x.done && <CheckIcon size={12} />}{x.label}</span>)}
      </div>

      <ActionForm action={saveBrandAction.bind(null, slug)} className="flex flex-col gap-6">
        <section id="canva" className="card p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Canva</h2>
              <p className="text-sm text-[var(--muted)] max-w-2xl">Os carrosséis modelo do cliente, com as fontes, cores e páginas que se repetem (capa, slides e convite final). Cada modelo é um design no Canva. O Estúdio monta cada carrossel novo com um modelo só, do início ao fim, na pasta do cliente. Para mudar o desenho, mude o modelo no Canva.</p>
            </div>
            <a href={studioHref(slug)} target="_blank" rel="noreferrer" className="ct-btn">Abrir Estúdio de Carrosséis<ArrowUpRightIcon size={14} /></a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="label">Modelos</span>
            {linhas.map((m, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[11rem_minmax(0,1fr)_auto] gap-2 items-center">
                <input name="modeloNome" defaultValue={m.nome} placeholder={i === 0 ? "Nome (ex.: Autoridade)" : "Nome"} aria-label={`Nome do modelo ${i + 1}`} className="ct-input" />
                <input name="modeloLink" type="url" inputMode="url" defaultValue={m.link} placeholder="https://www.canva.com/design/... ou https://canva.link/..." aria-label={`Link do modelo ${i + 1}`} className="ct-input min-w-0" />
                {m.link ? <a href={m.link} target="_blank" rel="noreferrer" className="ct-btn justify-self-start">Abrir no Canva<ArrowUpRightIcon size={14} /></a> : <span className="hidden sm:block" />}
              </div>
            ))}
            <p className="text-xs text-[var(--muted)]">O primeiro é o padrão. Para tirar um modelo, apague o link. Precisa de mais linhas? Salve e aparecem outras duas (até {MAX_MODELOS}). Use o link de um design (no Canva, Compartilhar e Copiar link), não de um modelo da marca.</p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="label">Pasta do cliente no Canva (opcional)</span>
            <input name="canvaPasta" defaultValue={k.canvaPasta ?? ""} placeholder="https://www.canva.com/folder/... (sem pasta, o Estúdio cria uma com o nome do cliente)" className="ct-input" />
          </label>
          <p className="text-sm">Meta do plano: <b>{meta} {meta === 1 ? "carrossel" : "carrosséis"} por mês</b>. Neste mês: {feitos} no planejamento. <Link href={`/cliente/${slug}/conteudo`} className="underline">Ir para o conteúdo</Link></p>
        </section>

        <section className="card p-5 flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">Tom de voz e regras</h2>
            <p className="text-sm text-[var(--muted)]">Como o cliente fala, para quem, o que nunca usar e as palavras de chamada. Uma regra por linha. O Claude lê antes de escrever.</p>
          </div>
          <textarea name="rules" rows={8} defaultValue={k.rules ?? ""} placeholder={"Nunca usar emoji.\nSem promessa de resultado.\nCTA com palavra para comentar."} className="ct-input" />
        </section>

        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">Fotos</h2>
            <p className="text-sm text-[var(--muted)]">Pasta do Google Drive com as fotos do cliente (dentro da pasta Clientes), compartilhada como “qualquer pessoa com o link”.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input name="driveFolder" defaultValue={k.driveFolder ?? ""} placeholder="https://drive.google.com/drive/folders/..." className="ct-input flex-1 min-w-[280px]" />
            {k.driveFolder && <a href={k.driveFolder.startsWith("http") ? k.driveFolder : `${DRIVE_WEB}/drive/folders/${k.driveFolder}`} target="_blank" rel="noreferrer" className="ct-btn"><FolderIcon size={16} />Abrir pasta<ArrowUpRightIcon size={14} /></a>}
          </div>
          {k.driveFolder && <DrivePhotos link={k.driveFolder} />}
        </section>

        <div className="card flex flex-wrap items-center gap-3 sticky bottom-3 p-3 shadow-sm">
          <button className="ct-btn ct-btn-dark">Salvar kit</button>
          {k.updatedAt && <span className="text-xs text-[var(--muted)]">Última edição: {when(k.updatedAt)} por {k.updatedBy}</span>}
        </div>
      </ActionForm>
    </Shell>
  );
}
