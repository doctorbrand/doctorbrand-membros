"use client";

import JSZip from "jszip";
import { useState } from "react";
import type { ActionResult } from "@/lib/types";
import type { ImportItem } from "@/app/cliente/[slug]/conteudo/actions";
import type { Media } from "@/lib/content";
import { uploadMedia } from "./upload";

type ImportAction = (items: ImportItem[], opts: { start: string; everyDays: number; times: string[]; send: boolean }) => Promise<ActionResult>;

interface Folder { key: string; order: number; title: string; files: { name: string; entry: JSZip.JSZipObject }[]; caption: string; agenda?: string; cover?: JSZip.JSZipObject }

const IMG = /\.(jpe?g|png)$/i;
const VID = /\.mp4$/i;
const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();

function titleFrom(folder: string) {
  const t = folder.replace(/^post[-_ ]*/i, "").replace(/^\d+[-_ .]*/, "").replace(/[-_]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : folder;
}

/** PNG vira JPG no navegador (o Instagram só publica JPG). JPG passa intacto. */
async function toJpeg(blob: Blob, name: string): Promise<Blob> {
  if (/\.jpe?g$/i.test(name)) return new Blob([blob], { type: "image/jpeg" });
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao converter PNG"))), "image/jpeg", 0.95));
}

/**
 * Importa um pacote .zip com uma pasta por post (ex.: post-01-manifesto/01.jpg, 02.jpg, legenda.txt;
 * Reels: o .mp4 e, se quiser, capa.jpg). Cria os posts em ordem, com datas distribuídas.
 */
export function ZipImport({ slug, action, local, defaultStart, everyDays }: { slug: string; action: ImportAction; local: boolean; defaultStart: string; everyDays: number }) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [start, setStart] = useState(defaultStart);
  const [gap, setGap] = useState(everyDays);
  const [times, setTimes] = useState("12:00, 18:30");
  const [send, setSend] = useState(true);

  async function read(file: File) {
    setErr(null); setDone(null); setBusy("Lendo o pacote…");
    try {
      const zip = await JSZip.loadAsync(file);
      const map = new Map<string, Folder>();
      const entries = Object.values(zip.files).filter((e) => !e.dir && !/(^|\/)(__MACOSX|\.)/.test(e.name));
      for (const e of entries) {
        const parts = e.name.split("/").filter(Boolean);
        if (parts.length < 2) continue; // arquivos soltos na raiz (bio, foto de perfil) ficam de fora
        const folder = parts[parts.length - 2];
        const name = parts[parts.length - 1];
        const key = parts.slice(0, -1).join("/");
        if (!map.has(key)) {
          const m = folder.match(/(\d+)/);
          map.set(key, { key, order: m ? Number(m[1]) : 9999, title: titleFrom(folder), files: [], caption: "" });
        }
        const f = map.get(key)!;
        if (/legenda.*\.txt$|caption.*\.txt$/i.test(name)) f.caption = (await e.async("string")).replace(/\r\n?/g, "\n").trim();
        else if (/^agenda.*\.txt$/i.test(name)) f.agenda = (await e.async("string")).trim();
        else if (/^capa\b/i.test(name) && IMG.test(name)) f.cover = e;
        else if (IMG.test(name) || VID.test(name)) f.files.push({ name, entry: e });
      }
      const all = [...map.values()].filter((f) => f.files.length);
      const named = all.filter((f) => /^post[-_ ]?\d/i.test(f.key.split("/").pop() ?? ""));
      // Com o padrão (post-01-…), pastas como "00 Perfil" ficam de fora.
      const list = (named.length ? named : all).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
      list.forEach((f) => f.files.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })));
      if (!list.length) throw new Error("Não encontrei pastas de posts com imagens ou vídeo no zip.");
      setFolders(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  }

  async function run() {
    setErr(null);
    const items: ImportItem[] = [];
    const total = folders.reduce((a, f) => a + f.files.length + (f.cover ? 1 : 0), 0);
    let n = 0;
    try {
      for (const f of folders) {
        const media: Media[] = [];
        const base = `content-media/${slug}/pacote/${safe(f.key.split("/").pop() ?? f.key)}`;
        for (const x of f.files) {
          n++; setBusy(`Enviando ${n} de ${total}: ${f.title} · ${x.name}`);
          const raw = await x.entry.async("blob");
          const video = VID.test(x.name);
          const blob = video ? new Blob([raw], { type: "video/mp4" }) : await toJpeg(raw, x.name);
          const path = await uploadMedia(`${base}/${safe(x.name).replace(/\.png$/i, ".jpg")}`, blob, local);
          media.push({ path, kind: video ? "video" : "image", name: x.name, mime: video ? "video/mp4" : "image/jpeg" });
        }
        let cover: Media | undefined;
        if (f.cover) {
          n++; setBusy(`Enviando ${n} de ${total}: capa de ${f.title}`);
          const path = await uploadMedia(`${base}/capa.jpg`, await toJpeg(await f.cover.async("blob"), f.cover.name), local);
          cover = { path, kind: "image", name: "capa.jpg", mime: "image/jpeg" };
        }
        items.push({ title: f.title, caption: f.caption, media, cover, agenda: f.agenda });
      }
      setBusy("Criando os posts…");
      const r = await action(items, { start, everyDays: gap, times: times.split(/[,\s]+/).filter((t) => /^\d{2}:\d{2}$/.test(t)), send });
      if (!r.ok) throw new Error(r.message);
      setDone(r.message); setFolders([]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  }

  if (!open) return <button type="button" className="ct-btn" onClick={() => setOpen(true)}>Importar pacote (.zip)</button>;

  return (
    <section className="card p-4 flex flex-col gap-3 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="font-medium">Importar pacote de posts</p>
        <button type="button" className="text-sm text-[var(--muted)]" onClick={() => { setOpen(false); setFolders([]); }}>Fechar</button>
      </div>
      <p className="text-sm text-[var(--muted)]">Uma pasta por post, na ordem de publicação (<b>post-01-…</b>, <b>post-02-…</b>). Dentro: imagens numeradas (01.jpg, 02.jpg…) ou o vídeo .mp4, <b>legenda.txt</b> e, no Reels, <b>capa.jpg</b>. As imagens vão em qualidade original; PNG vira JPG.</p>
      {!folders.length && (
        <label className={`ct-btn self-start ${busy ? "opacity-50" : "cursor-pointer"}`}>Escolher arquivo .zip
          <input type="file" hidden accept=".zip,application/zip" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
        </label>
      )}
      {folders.length > 0 && (
        <>
          <div className="scroll-x">
            <table className="data">
              <thead><tr><th>#</th><th>Post</th><th>Formato</th><th>Data</th><th>Legenda</th></tr></thead>
              <tbody>
                {folders.map((f, i) => {
                  const vids = f.files.filter((x) => VID.test(x.name)).length;
                  const kind = f.files.length > 1 ? `Carrossel · ${f.files.length}` : vids ? `Reels${f.cover ? " · com capa" : ""}` : "Foto única";
                  return <tr key={f.key}><td>{i + 1}</td><td>{f.title}</td><td>{kind}</td><td>{f.agenda ?? "automática"}</td><td className="max-w-[320px] truncate text-left" title={f.caption}>{f.caption ? f.caption.split("\n")[0] : <span className="g-warn">sem legenda.txt</span>}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1"><span className="label">Primeiro post em</span><input type="date" className="ct-input" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="flex flex-col gap-1"><span className="label">A cada (dias)</span><input type="number" min={1} max={14} className="ct-input w-24" value={gap} onChange={(e) => setGap(Number(e.target.value) || 1)} /></label>
            <label className="flex flex-col gap-1"><span className="label">Horários (alternam)</span><input className="ct-input w-40" value={times} onChange={(e) => setTimes(e.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} /> Já enviar para o cliente aprovar</label>
            <button type="button" className="ct-btn ct-btn-dark" disabled={!!busy} onClick={run}>Importar {folders.length} posts</button>
          </div>
        </>
      )}
      {busy && <p className="text-xs text-[var(--muted)]">{busy}</p>}
      {done && <p className="text-sm g-good">{done}</p>}
      {err && <p className="text-sm g-bad">{err}</p>}
    </section>
  );
}
