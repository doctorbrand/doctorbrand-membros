"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/types";
import type { DriveImport } from "@/app/cliente/[slug]/conteudo/actions";
import type { Media, Post, PostType } from "@/lib/content";
import { mediaKey, mediaUrl } from "@/lib/content-media";
import { uploadMedia } from "./upload";

type ActFd = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

interface Item extends Media { preview?: string }

const safeName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
const withPreview = (m: Media): Item => ({ ...m, preview: mediaUrl(m, 400) });
const strip = ({ preview: _p, ...m }: Item): Media => m; // eslint-disable-line @typescript-eslint/no-unused-vars

export function PostEditor({ slug, action, post, defaultDate, pillars, importDrive, local }: {
  slug: string; action: ActFd; post?: Post; defaultDate: string; pillars: string[];
  importDrive: (text: string) => Promise<DriveImport>; local: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  const [type, setType] = useState<PostType>(post?.type ?? "imagem");
  const [items, setItems] = useState<Item[]>(post?.media.map(withPreview) ?? []);
  const [cover, setCover] = useState<Item | undefined>(post?.cover ? withPreview(post.cover) : undefined);
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [links, setLinks] = useState("");
  const [source, setSource] = useState(post?.source ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const place = (incoming: Item[], t = type) => setItems((prev) => (t === "carrossel" ? [...prev, ...incoming].slice(0, 10) : incoming.slice(0, 1)));

  async function fromDrive() {
    setErr(null); setNote(null); setBusy("Lendo o Drive…");
    const r = await importDrive(links).catch((e) => ({ ok: false, message: String(e) } as DriveImport));
    setBusy(null);
    if (!r.ok || !r.media) return setErr(r.message);
    let t = type;
    const videos = r.media.filter((m) => m.kind === "video");
    if (r.media.length > 1 && type !== "carrossel") t = "carrossel";
    else if (r.media.length === 1 && videos.length === 1 && type === "imagem") t = "reels";
    setType(t);
    place(r.media.map(withPreview), t);
    if (r.cover) setCover(withPreview(r.cover));
    if (r.caption && !caption.trim()) setCaption(r.caption);
    setSource(links.trim());
    setLinks("");
    setNote(`${r.message}${t !== type ? ` Formato ajustado para ${t === "reels" ? "Reels" : "Carrossel"}.` : ""}${r.caption ? " Legenda lida do legenda.txt." : ""}${r.cover ? " Capa encontrada." : ""}`);
  }

  async function fromComputer(files: FileList | null, asCover = false) {
    if (!files?.length) return;
    setErr(null);
    const out: Item[] = [];
    for (const [i, f] of Array.from(files).entries()) {
      setBusy(`Enviando ${i + 1} de ${files.length}: ${f.name}`);
      try {
        const kind = f.type.startsWith("video/") ? "video" : "image";
        let name = safeName(f.name);
        if (kind === "image" && !/\.jpe?g$/.test(name)) name += ".jpg";
        if (kind === "video" && !/\.mp4$/.test(name)) name += ".mp4";
        const path = await uploadMedia(`content-media/${slug}/${name}`, f, local);
        out.push({ path, kind, name: f.name, mime: f.type, preview: kind === "image" ? URL.createObjectURL(f) : undefined });
      } catch (e) {
        setErr(`Falha ao enviar ${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(null);
    if (asCover) setCover(out[0]); else place(out);
  }

  const move = (i: number, d: -1 | 1) => setItems((prev) => {
    const j = i + d; if (j < 0 || j >= prev.length) return prev;
    const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  return (
    <form action={run} className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">{post ? "Editar post" : "Novo post"}</h2>
        <div className="flex gap-1">
          {(["imagem", "carrossel", "reels"] as PostType[]).map((t) => (
            <button key={t} type="button" onClick={() => { setType(t); if (t !== "carrossel") setItems((p) => p.slice(0, 1)); }}
              className={`px-3 py-1.5 rounded-full text-sm ${type === t ? "bg-[var(--ink)] text-white" : "border border-[var(--line)]"}`}>
              {t === "imagem" ? "Foto única" : t === "carrossel" ? "Carrossel" : "Reels"}
            </button>
          ))}
        </div>
      </div>
      <input type="hidden" name="id" value={post?.id ?? ""} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="media" value={JSON.stringify(items.map(strip))} />
      <input type="hidden" name="cover" value={cover ? JSON.stringify([strip(cover)]) : ""} />
      <input type="hidden" name="coverOffsetMs" value={post?.coverOffsetMs ?? ""} />

      <div className="grid sm:grid-cols-[1fr_150px_100px] gap-3">
        <label className="flex flex-col gap-1"><span className="label">Título interno</span>
          <input name="title" defaultValue={post?.title} required className="ct-input" placeholder="Ex.: Mitos da mastopexia" /></label>
        <label className="flex flex-col gap-1"><span className="label">Data</span>
          <input type="date" name="date" defaultValue={post?.date ?? defaultDate} required className="ct-input" /></label>
        <label className="flex flex-col gap-1"><span className="label">Hora</span>
          <input type="time" name="time" defaultValue={post?.time ?? "12:00"} className="ct-input" /></label>
      </div>
      <label className="flex flex-col gap-1 max-w-sm"><span className="label">Pilar editorial</span>
        <select name="pillar" defaultValue={post?.pillar ?? ""} className="ct-input">
          <option value="">Sem pilar</option>
          {pillars.map((p) => <option key={p} value={p}>{p}</option>)}
        </select></label>

      <div className="flex flex-col gap-2">
        <span className="label">{type === "reels" ? "Vídeo final (vertical 9:16)" : type === "carrossel" ? "Imagens ou vídeos (2 a 10, na ordem do carrossel)" : "Imagem (4:5)"}</span>
        {items.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map((m, i) => (
              <div key={mediaKey(m)} className="flex-none w-28 flex flex-col gap-1">
                <div className="relative w-28 h-36 rounded-lg overflow-hidden bg-[#1a1a1a] grid place-items-center">
                  {m.preview ? <img src={m.preview} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] text-white/80 px-2 text-center">{m.name ?? "vídeo"}</span>}
                  <span className="ct-num">{i + 1}</span>
                  <span className="absolute right-1.5 bottom-1.5 text-[10px] font-semibold bg-white/90 rounded px-1.5">{m.driveId ? "Drive" : "Enviado"}{m.kind === "video" ? " · vídeo" : ""}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <button type="button" onClick={() => move(i, -1)} className="px-1" aria-label="Mover para a esquerda">←</button>
                  <button type="button" onClick={() => setItems((p) => p.filter((_, k) => k !== i))} className="g-bad">remover</button>
                  <button type="button" onClick={() => move(i, 1)} className="px-1" aria-label="Mover para a direita">→</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-[var(--line)] p-3 flex flex-col gap-2 bg-[#fafaf8]">
          <span className="text-sm font-medium">Do Google Drive <span className="text-[var(--muted)] font-normal">(recomendado: qualidade original, vídeo leve para o cliente)</span></span>
          <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} className="ct-input" placeholder="Cole o link da pasta do post ou dos arquivos (um por linha)" />
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className="ct-btn ct-btn-dark" disabled={!links.trim() || !!busy} onClick={fromDrive}>Importar do Drive</button>
            <label className={`ct-btn ${busy ? "opacity-50" : "cursor-pointer"}`}>Enviar do computador
              <input type="file" hidden multiple={type === "carrossel"} accept={type === "reels" ? "video/mp4" : type === "carrossel" ? "image/jpeg,video/mp4" : "image/jpeg"}
                onChange={(e) => { fromComputer(e.target.files); e.target.value = ""; }} disabled={!!busy} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="label">Link salvo do Drive</span>
            <input name="source" value={source} onChange={(e) => setSource(e.target.value)} className="ct-input" placeholder="Pasta das lâminas ou arquivo do vídeo (usado em “Atualizar do Drive”)" />
          </label>
          <p className="text-xs text-[var(--muted)]">Pasta do post: arquivos numerados (1.jpg, 2.jpg… ou o vídeo), <b>legenda.txt</b> e, no Reels, <b>capa.jpg</b> se quiser. Compartilhe a pasta do cliente como “qualquer pessoa com o link”.</p>
        </div>
        {type === "reels" && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="label">Capa</span>
            {cover?.preview && <img src={cover.preview} alt="" className="w-12 h-16 object-cover rounded" />}
            <label className={`ct-btn ${busy ? "opacity-50" : "cursor-pointer"}`}>{cover ? "Trocar imagem" : "Enviar imagem"}
              <input type="file" hidden accept="image/jpeg" onChange={(e) => { fromComputer(e.target.files, true); e.target.value = ""; }} disabled={!!busy} />
            </label>
            {cover && <button type="button" className="text-xs g-bad" onClick={() => setCover(undefined)}>remover</button>}
            <span className="text-xs text-[var(--muted)]">Ou escolha um frame do vídeo depois de salvar.</span>
          </div>
        )}
        {busy && <p className="text-xs text-[var(--muted)]">{busy}</p>}
        {note && <p className="text-xs g-good">{note}</p>}
        {err && <p className="text-xs g-bad">{err}</p>}
      </div>

      <label className="flex flex-col gap-1">
        <span className="label flex justify-between"><span>Legenda</span><span className={caption.length > 2200 ? "g-bad" : ""}>{caption.length}/2200</span></span>
        <textarea name="caption" rows={8} value={caption} onChange={(e) => setCaption(e.target.value)} className="ct-input" placeholder="Legenda completa, com hashtags." />
      </label>

      <div className="flex gap-2 flex-wrap items-center">
        <button name="intent" value="enviar" disabled={pending || !!busy} className="ct-btn ct-btn-primary">Enviar para aprovação</button>
        <button name="intent" value="rascunho" disabled={pending || !!busy} className="ct-btn">{post && post.status !== "rascunho" ? "Salvar sem reenviar" : "Salvar rascunho"}</button>
        {pending && <span className="text-xs text-[var(--muted)]">Salvando…</span>}
        {state && !state.ok && <span className="text-xs g-bad">{state.message}</span>}
      </div>
    </form>
  );
}
