import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { BrandColorsAndPreview } from "@/components/brand/BrandEditor";
import { BrandFileUpload } from "@/components/brand/BrandFileUpload";
import { SlidePreview, type PreviewAssets } from "@/components/brand/SlidePreview";
import { TemplateEditor } from "@/components/brand/TemplateEditor";
import { ActionButton } from "@/components/content/ContentActions";
import { ArrowUpRightIcon, CheckIcon, FolderIcon } from "@/components/Icons";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/brandStore";
import { blankTemplate, brandChecklist, colorFor, googleFontCss, LOGO_SLOTS, MAX_TEMPLATES, SLIDE_KINDS, type BrandFont, type BrandKit } from "@/lib/brand";
import { getClient } from "@/lib/clients";
import { getPlan, getPosts, monthlyByType } from "@/lib/content";
import { DRIVE_WEB, mediaUrl } from "@/lib/content-media";
import { driveFolderFiles, parseDriveLinks } from "@/lib/drive";
import { localDir } from "@/lib/store";
import { clearBrandFileAction, createBaseTemplatesAction, deleteTemplateAction, saveBrandAction, saveTemplateAction, setBrandFileAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const fileUrl = (path: string) => `/api/media?p=${encodeURIComponent(path)}`;

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Fundo escuro? (para escolher a versão do logo na prévia) */
function isDark(hex?: string) {
  if (!hex) return true;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

/** @font-face das fontes enviadas e <link> das do Google, para a prévia usar a fonte real. */
function FontLoaders({ k }: { k: BrandKit }) {
  const fonts = [k.fonts.titulo, k.fonts.texto].filter((f): f is BrandFont => !!f?.family);
  const files = fonts.filter((f) => f.source === "arquivo" && f.path);
  const google = fonts.filter((f) => f.source === "google");
  return (
    <>
      {google.map((f) => <link key={`${f.family}-${f.weight}`} rel="stylesheet" href={googleFontCss(f.family, f.weight)} precedence="default" />)}
      {files.length > 0 && <style>{files.map((f) => `@font-face{font-family:"${f.family.replace(/"/g, "")}";src:url("${fileUrl(f.path!)}");font-weight:${f.weight ?? 400};font-display:swap}`).join("\n")}</style>}
    </>
  );
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

/** Primeira foto da pasta do Drive do kit (só para a prévia da caixa de imagem). */
async function samplePhoto(link?: string): Promise<string | undefined> {
  const id = link ? parseDriveLinks(link).folders[0] : undefined;
  if (!id) return undefined;
  const f = (await driveFolderFiles(id).catch(() => [])).find((x) => x.mime.startsWith("image/"));
  return f ? mediaUrl({ driveId: f.id, kind: "image" }, 720) : undefined;
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
  const local = !!localDir();
  const checks = brandChecklist(k);
  const done = checks.filter((x) => x.done).length;
  const darkBg = isDark(colorFor(k, "fundo"));
  const previewLogo = (darkBg ? k.logos.escuro : k.logos.claro) ?? k.logos.principal;
  const save = setBrandFileAction;
  const templates = k.templates ?? [];
  const logoUrls: PreviewAssets["logos"] = { principal: k.logos.principal && fileUrl(k.logos.principal.path), claro: k.logos.claro && fileUrl(k.logos.claro.path), escuro: k.logos.escuro && fileUrl(k.logos.escuro.path) };
  const photo = await samplePhoto(k.driveFolder);
  const assets: PreviewAssets = { logos: logoUrls, photo, fileUrl };
  const editing = templates.find((t) => t.id === sp.modelo);
  const creating = sp.modelo === "novo" && templates.length < MAX_TEMPLATES;
  const base = `/cliente/${slug}/marca`;
  const colorsReady = (["fundo", "texto", "destaque"] as const).every((r) => !!colorFor(k, r));

  return (
    <Shell active="marca" session={session} clientSlug={slug}>
      <FontLoaders k={k} />
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="label">{c.name} · {c.specialty}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Kit de marca</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">Logos, cores, fontes, fotos e regras do cliente. É a base dos modelos de carrossel e de tudo que a área gerar com a cara dele. Só a equipe vê esta página.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`pill ${done === checks.length ? "pill-green" : done >= 3 ? "pill-info" : "pill-yellow"}`}>{done} de {checks.length} prontos</span>
          <Link href={`/cliente/${slug}/perfil`} className="ct-btn">Perfil</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {checks.map((x) => <span key={x.label} className={`pill ${x.done ? "pill-green" : ""}`}>{x.done && <CheckIcon size={12} />}{x.label}</span>)}
      </div>

      <section className="card p-5 mb-6 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Logos</h2>
          <p className="text-sm text-[var(--muted)]">PNG com fundo transparente ou SVG. As versões para fundo claro e escuro evitam logo sumindo no slide.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {LOGO_SLOTS.map((l) => {
            const f = k.logos[l.key];
            const dark = l.key === "escuro";
            return (
              <div key={l.key} className="flex flex-col gap-2">
                <span className="label">{l.label}</span>
                <div className="h-28 rounded-xl border border-[var(--line)] grid place-items-center p-4" style={{ background: dark ? (colorFor(k, "fundo") && isDark(colorFor(k, "fundo")) ? colorFor(k, "fundo") : "#1a1a1a") : "#fafaf8" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f ? <img src={fileUrl(f.path)} alt={l.label} className="max-h-20 max-w-full object-contain" /> : <span className="text-xs" style={{ color: dark ? "#8e8e93" : "var(--muted)" }}>sem arquivo</span>}
                </div>
                <BrandFileUpload slug={slug} slot={l.key} accept="image/png,image/svg+xml,image/webp" label={f ? "Trocar" : "Enviar"} local={local} save={save} clear={f ? clearBrandFileAction.bind(null, slug, l.key) : undefined} />
                <span className="text-xs text-[var(--muted)]">{l.hint}</span>
              </div>
            );
          })}
        </div>
      </section>

      <ActionForm action={saveBrandAction.bind(null, slug)} className="flex flex-col gap-6">
        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">Cores</h2>
            <p className="text-sm text-[var(--muted)]">Fundo, texto e destaque são obrigatórias para gerar slides. Use o código exato do manual de marca.</p>
          </div>
          <BrandColorsAndPreview initial={k.colors} titleFont={k.fonts.titulo?.family} textFont={k.fonts.texto?.family} titleWeight={k.fonts.titulo?.weight} logoUrl={previewLogo ? fileUrl(previewLogo.path) : undefined} />
        </section>

        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">Fontes</h2>
            <p className="text-sm text-[var(--muted)]">Nome exato do Google Fonts (ex.: Inter, Playfair Display) ou envie o arquivo da fonte paga (TTF, OTF ou WOFF2). Fonte enviada tem prioridade.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {(["titulo", "texto"] as const).map((key) => {
              const f = k.fonts[key];
              const label = key === "titulo" ? "Títulos" : "Texto";
              return (
                <div key={key} className="flex flex-col gap-3">
                  <span className="label">{label}</span>
                  <div className="grid grid-cols-[1fr_96px] gap-2">
                    <input name={`font_${key}_family`} defaultValue={f?.family ?? ""} placeholder={key === "titulo" ? "ex.: Playfair Display" : "ex.: Inter"} className="ct-input" />
                    <input name={`font_${key}_weight`} defaultValue={f?.weight ?? ""} inputMode="numeric" placeholder="peso" className="ct-input" title="Peso: 400 regular, 600 semibold, 700 bold" />
                  </div>
                  <p className="rounded-xl border border-[var(--line)] p-4 bg-[#fafaf8]" style={{ fontFamily: f?.family ? `"${f.family}", sans-serif` : undefined, fontWeight: f?.weight ?? (key === "titulo" ? 700 : 400), fontSize: key === "titulo" ? 26 : 15, lineHeight: 1.25 }}>
                    {key === "titulo" ? "Técnica é obrigação. Autoridade é arquitetura." : "O paciente não decide por técnica. Decide por sinais que encontra antes de chegar na consulta."}
                  </p>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted)]">{f?.source === "arquivo" ? `Arquivo enviado: ${f.path?.split("/").pop()}` : f?.family ? "Carregada do Google Fonts." : "Sem fonte definida."}</span>
                    <BrandFileUpload slug={slug} slot={`font_${key}`} accept=".ttf,.otf,.woff2,.woff,font/ttf,font/otf,font/woff2" label={f?.source === "arquivo" ? "Trocar arquivo" : "Enviar arquivo da fonte"} local={local} save={save} clear={f?.source === "arquivo" ? clearBrandFileAction.bind(null, slug, `font_${key}`) : undefined} clearLabel="Usar Google Fonts" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">Fotos</h2>
            <p className="text-sm text-[var(--muted)]">Pasta do Google Drive com as fotos do cliente (consultório, retrato, bastidor), compartilhada como “qualquer pessoa com o link”. É daqui que os slides com imagem puxam as fotos.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input name="driveFolder" defaultValue={k.driveFolder ?? ""} placeholder="https://drive.google.com/drive/folders/..." className="ct-input flex-1 min-w-[280px]" />
            {k.driveFolder && <a href={k.driveFolder.startsWith("http") ? k.driveFolder : `${DRIVE_WEB}/drive/folders/${k.driveFolder}`} target="_blank" rel="noreferrer" className="ct-btn"><FolderIcon size={16} />Abrir pasta<ArrowUpRightIcon size={14} /></a>}
          </div>
          {k.driveFolder && <DrivePhotos link={k.driveFolder} />}
        </section>

        <section className="card p-5 flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">Regras da marca</h2>
            <p className="text-sm text-[var(--muted)]">Uma por linha. Valem para tudo que a área gerar com a marca do cliente: o Claude lê antes de escrever e os modelos respeitam ao montar.</p>
          </div>
          <textarea name="rules" rows={6} defaultValue={k.rules ?? ""} placeholder={"Logo só no último slide.\nNunca foto de paciente.\nMáximo de 25 palavras por slide."} className="ct-input" />
        </section>

        <div className="card flex flex-wrap items-center gap-3 sticky bottom-3 p-3 shadow-sm">
          <button className="ct-btn ct-btn-dark">Salvar kit</button>
          <span className="text-xs text-[var(--muted)]">Logos e arquivos de fonte salvam sozinhos ao enviar.</span>
          {k.updatedAt && <span className="text-xs text-[var(--muted)]">Última edição: {when(k.updatedAt)} por {k.updatedBy}</span>}
        </div>
      </ActionForm>

      <section id="modelos" className="card p-5 mt-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Modelos de carrossel</h2>
            <p className="text-sm text-[var(--muted)] max-w-2xl">Até {MAX_TEMPLATES} por cliente. Cada modelo tem capa, slide de texto, slide com imagem e slide final, com fundo (cor do kit ou imagem do Canva) e caixas de título, texto, imagem e logo.</p>
          </div>
          {templates.length > 0 && <Link href={`/cliente/${slug}/carrossel`} className="ct-btn ct-btn-dark">Montar carrossel</Link>}
          {templates.length < MAX_TEMPLATES && (
            colorsReady
              ? <ActionButton action={createBaseTemplatesAction.bind(null, slug)} label="Criar 3 modelos-base com as cores do kit" />
              : <span className="text-xs text-[var(--muted)] max-w-[260px]">Salve as cores de fundo, texto e destaque para criar os modelos-base.</span>
          )}
        </div>
        <p className="text-sm">Meta do plano: <b>{meta} {meta === 1 ? "carrossel" : "carrosséis"} por mês</b> ({plan.postsPerWeek} posts por semana, {plan.mix.carrossel}% carrossel). Neste mês: {feitos} no planejamento. <Link href={`/cliente/${slug}/conteudo`} className="underline">Ajustar metas</Link></p>
        <div className="grid sm:grid-cols-3 gap-3">
          {Array.from({ length: MAX_TEMPLATES }, (_, i) => templates[i]).map((t, i) => t ? (
            <Link key={t.id} href={`${base}?modelo=${t.id}#modelos`} scroll={false} className={`tm-card ${editing?.id === t.id ? "is-on" : ""}`}>
              <div className="tm-slides">
                {SLIDE_KINDS.map((s) => <SlidePreview key={s.key} layout={t.slides[s.key]} k={k} assets={assets} className={s.key === "capa" ? "tm-main" : "tm-mini"} />)}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t.name}</span>
                <span className="text-xs text-[var(--muted)] shrink-0">Editar</span>
              </div>
            </Link>
          ) : (
            <Link key={`vazio-${i}`} href={`${base}?modelo=novo#modelos`} scroll={false} className={`tm-empty ${creating && i === templates.length ? "is-on" : ""}`}>
              <span className="text-2xl font-light leading-none">+</span>
              <span>Novo modelo</span>
            </Link>
          ))}
        </div>
        {(editing || creating) && (
          <TemplateEditor key={editing?.id ?? "novo"} slug={slug} kit={k} logos={logoUrls} photo={photo} local={local}
            initial={editing ?? blankTemplate()} isNew={!editing}
            save={saveTemplateAction.bind(null, slug)} remove={editing ? deleteTemplateAction.bind(null, slug, editing.id) : undefined}
            backHref={`${base}#modelos`} />
        )}
      </section>
    </Shell>
  );
}
