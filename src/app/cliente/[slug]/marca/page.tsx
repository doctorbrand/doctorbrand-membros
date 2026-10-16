import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionButton } from "@/components/content/ContentActions";
import { ArrowUpRightIcon, CheckIcon, FolderIcon } from "@/components/Icons";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/brandStore";
import { brandChecklist, camposTexto, MAX_MODELOS, type CanvaModelo } from "@/lib/brand";
import { usaModelosDoctorbrand } from "@/lib/canvaPresets";
import { getClient } from "@/lib/clients";
import { getPlan, getPosts, monthlyByType } from "@/lib/content";
import { DRIVE_WEB, mediaUrl } from "@/lib/content-media";
import { driveFolderFiles, parseDriveLinks } from "@/lib/drive";
import { addModelosDoctorbrandAction, removeModeloAction, saveBrandAction, saveModeloAction } from "./actions";

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

function ModeloForm({ slug, m }: { slug: string; m?: CanvaModelo }) {
  return (
    <ActionForm action={saveModeloAction.bind(null, slug, m?.id ?? null)} className="flex flex-col gap-3">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
        <label className="flex flex-col gap-1"><span className="label">Nome</span><input name="titulo" defaultValue={m?.titulo ?? ""} placeholder="ex.: Autoridade" className="ct-input" /></label>
        <label className="flex flex-col gap-1"><span className="label">Link do modelo no Canva</span><input name="link" defaultValue={m?.link ?? ""} placeholder="https://www.canva.com/design/..." className="ct-input" /></label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="label">Colunas da planilha, na ordem das lâminas</span>
        <textarea name="campos" rows={10} defaultValue={m ? camposTexto(m.campos) : ""} placeholder={"capa_titulo 10\ncapa_texto 14\nfoto_capa foto\nl2_titulo 8\nl2_texto 40\ncta_keyword 1"} className="ct-input mono text-[13px]" />
        <span className="text-xs text-[var(--muted)]">Uma por linha: o nome da coluna e quantas palavras cabem na caixa. Colunas de foto terminam com &quot;foto&quot;. No Canva, cada coluna é ligada à caixa certa no Criar em massa.</span>
      </label>
      <div><button className="ct-btn ct-btn-dark">{m ? "Salvar modelo" : "Adicionar modelo"}</button></div>
    </ActionForm>
  );
}

export default async function MarcaPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ modelo?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const session = await requireAdmin();
  const c = await getClient(slug);
  if (!c) notFound();
  const [k, plan, posts] = await Promise.all([getBrand(slug), getPlan(slug), getPosts(slug)]);
  const meta = monthlyByType(plan).carrossel;
  const mes = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const feitos = posts.filter((p) => p.type === "carrossel" && p.date?.startsWith(mes)).length;
  const checks = brandChecklist(k);
  const done = checks.filter((x) => x.done).length;
  const base = `/cliente/${slug}/marca`;
  const modelos = k.canvaModelos ?? [];
  const aberto = modelos.find((m) => m.id === sp.modelo);
  const novo = sp.modelo === "novo" && modelos.length < MAX_MODELOS;
  const dbFaltando = usaModelosDoctorbrand(slug) && !["autoridade", "editorial", "manchete", "consultoria", "bastidor"].every((t) => modelos.some((m) => m.titulo.toLowerCase() === t));

  return (
    <Shell active="marca" session={session} clientSlug={slug}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="label">{c.name} · {c.specialty}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Kit de marca</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">O visual do cliente (logos, cores, fontes e o desenho dos carrosséis) fica no Canva. Aqui ficam os modelos do Canva deste cliente, as regras de texto e a pasta de fotos. Só a equipe vê esta página.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`pill ${done === checks.length ? "pill-green" : done >= 2 ? "pill-info" : "pill-yellow"}`}>{done} de {checks.length} prontos</span>
          <Link href={`/cliente/${slug}/perfil`} className="ct-btn">Perfil</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {checks.map((x) => <span key={x.label} className={`pill ${x.done ? "pill-green" : ""}`}>{x.done && <CheckIcon size={12} />}{x.label}</span>)}
      </div>

      <section id="modelos" className="card p-5 mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Modelos do Canva</h2>
            <p className="text-sm text-[var(--muted)] max-w-2xl">Para cada modelo, as colunas da planilha do Criar em massa e quantas palavras cabem em cada uma. O Claude escreve o texto de cada carrossel dentro desses limites e a área de membros baixa a planilha pronta, em Conteúdo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dbFaltando && <ActionButton action={addModelosDoctorbrandAction.bind(null, slug)} label="Pôr os 5 modelos DoctorBrand" />}
            {modelos.length < MAX_MODELOS && <Link href={`${base}?modelo=novo#modelos`} scroll={false} className="ct-btn">Novo modelo</Link>}
          </div>
        </div>
        <p className="text-sm">Meta do plano: <b>{meta} {meta === 1 ? "carrossel" : "carrosséis"} por mês</b>. Neste mês: {feitos} no planejamento. <Link href={`/cliente/${slug}/conteudo`} className="underline">Ir para o conteúdo</Link></p>

        {modelos.length === 0 && !novo && <p className="text-sm text-[var(--muted)]">Nenhum modelo ainda.</p>}
        {modelos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {modelos.map((m) => {
              const textos = m.campos.filter((x) => x.tipo === "text").length;
              const fotos = m.campos.filter((x) => x.tipo === "image").length;
              return (
                <Link key={m.id} href={`${base}?modelo=${m.id}#modelos`} scroll={false} className={`tm-card ${aberto?.id === m.id ? "is-on" : ""}`}>
                  <span className="font-medium truncate">{m.titulo}</span>
                  <span className="text-xs text-[var(--muted)]">{textos} {textos === 1 ? "coluna" : "colunas"} de texto{fotos ? ` · ${fotos} de foto` : ""}</span>
                  <span className={`text-xs ${m.link ? "text-[var(--muted)]" : "g-warn"}`}>{m.link ? "Link do Canva salvo" : "Falta o link do Canva"}</span>
                </Link>
              );
            })}
          </div>
        )}

        {(aberto || novo) && (
          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-semibold">{aberto ? aberto.titulo : "Novo modelo"}</h3>
              <div className="flex flex-wrap gap-2">
                {aberto?.link && <a href={aberto.link} target="_blank" rel="noreferrer" className="ct-btn">Abrir no Canva<ArrowUpRightIcon size={14} /></a>}
                {aberto && <ActionButton action={removeModeloAction.bind(null, slug, aberto.id)} label="Tirar do cliente" variant="ghost" confirm={`Tirar "${aberto.titulo}" deste cliente? No Canva ele continua igual.`} />}
                <Link href={`${base}#modelos`} scroll={false} className="ct-btn">Fechar</Link>
              </div>
            </div>
            <ModeloForm key={aberto?.id ?? "novo"} slug={slug} m={aberto} />
          </div>
        )}
      </section>

      <ActionForm action={saveBrandAction.bind(null, slug)} className="flex flex-col gap-6">
        <section className="card p-5 flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">Regras de texto</h2>
            <p className="text-sm text-[var(--muted)]">Uma por linha. O Claude lê antes de escrever o texto das lâminas deste cliente.</p>
          </div>
          <textarea name="rules" rows={8} defaultValue={k.rules ?? ""} placeholder={"Nunca usar emoji.\nSem promessa de resultado.\nCTA com palavra para comentar."} className="ct-input" />
        </section>

        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">Fotos</h2>
            <p className="text-sm text-[var(--muted)]">Pasta do Google Drive com as fotos do cliente (dentro da pasta Clientes), compartilhada como “qualquer pessoa com o link”. É daqui que saem as fotos das colunas de foto no Canva.</p>
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
