import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionButton } from "@/components/content/ContentActions";
import { AlertIcon, CheckIcon, RefreshIcon } from "@/components/Icons";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getAudits, type FeedAudit } from "@/lib/feedAudit";
import { getProfile, PROFILE_FIELDS, profileCompleteness } from "@/lib/profile";
import { runAuditAction, saveProfileAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GROUPS = { base: "Base estratégica", voz: "Voz e linguagem", operacao: "Operação do conteúdo" } as const;

function tone(n: number) {
  return n >= 85 ? "pill-green" : n >= 70 ? "pill-info" : n >= 50 ? "pill-yellow" : "pill-red";
}

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AuditCard({ a, prev }: { a: FeedAudit; prev?: FeedAudit }) {
  const delta = prev ? a.total - prev.total : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className={`ct-score ${tone(a.total)}`} style={{ width: 64, height: 64, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 22, fontWeight: 700 }}>{a.total}</div>
        <div>
          <p className="font-medium">@{a.handle ?? "perfil"} · {a.postsRead} posts lidos{a.followers ? ` · ${a.followers.toLocaleString("pt-BR")} seguidores` : ""}</p>
          <p className="text-xs text-[var(--muted)]">Lido em {when(a.at)} por {a.by} · fonte: {a.source === "meta" ? "Meta (conta ligada)" : "Apify (perfil público)"}{delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta} desde a leitura anterior` : ""}</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        {a.items.map((i) => (
          <div key={i.key} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm"><span>{i.label}</span><span className="mono">{i.score === null ? "–" : `${String(i.score).replace(".", ",")}/10`}</span></div>
            <div style={{ height: 4, borderRadius: 4, background: "var(--line)" }}><div style={{ height: 4, borderRadius: 4, width: `${(i.score ?? 0) * 10}%`, background: (i.score ?? 0) >= 7 ? "var(--good)" : (i.score ?? 0) >= 5 ? "var(--warn)" : "var(--bad)" }} /></div>
            <p className="text-xs text-[var(--muted)]">{i.detail}</p>
            {i.tip && <p className="text-xs inline-flex gap-1.5 items-start"><AlertIcon /> {i.tip}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function PerfilPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireAdmin();
  const c = await getClient(slug);
  if (!c) notFound();
  const [p, audits] = await Promise.all([getProfile(slug), getAudits(slug)]);
  const done = profileCompleteness(p);
  const input = "ct-input";

  return (
    <Shell active="perfil" session={session} clientSlug={slug}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="label">{c.name} · {c.specialty}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Perfil do cliente</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">Base para ler o feed, planejar e gerar roteiros e direção de stories. Só a equipe vê esta página.</p>
        </div>
        <div className="flex items-center gap-2 text-sm"><span className={`pill ${tone(done)}`}>{done}% preenchido</span><Link href={`/cliente/${slug}/conteudo`} className="ct-btn">Planejamento</Link></div>
      </div>

      <section className="card p-5 mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Como está o feed hoje</h2>
            <p className="text-sm text-[var(--muted)]">Leitura do Instagram publicado e nota por regras: frequência, constância, formatos, engajamento, legendas, hashtags, CFM, bio e visual.</p>
          </div>
          <div className="flex items-center gap-2"><RefreshIcon /><ActionButton action={runAuditAction.bind(null, slug)} label={audits.length ? "Ler de novo" : "Ler o feed agora"} variant="dark" /></div>
        </div>
        {audits[0] ? <AuditCard a={audits[0]} prev={audits[1]} /> : <p className="text-sm text-[var(--muted)]">{c.igUserId ? "A conta está ligada pela Meta. Clique em ler o feed." : "Preencha o @ do Instagram abaixo (ou ligue a conta pela Meta) e clique em ler o feed."}</p>}
        {audits.length > 1 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--muted)]">Histórico de leituras</summary>
            <ul className="mt-2 flex flex-col gap-1">{audits.slice(0, 12).map((a) => <li key={a.at} className="flex gap-3"><span className="mono w-10">{a.total}</span><span className="text-[var(--muted)]">{when(a.at)} · {a.postsRead} posts</span></li>)}</ul>
          </details>
        )}
      </section>

      <ActionForm action={saveProfileAction.bind(null, slug)} className="flex flex-col gap-6">
        <section className="card p-5 grid sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1"><span className="label">Instagram</span><input name="instagram" defaultValue={p.instagram ?? ""} placeholder="@perfil" className={input} /><span className="text-xs text-[var(--muted)]">Usado na leitura quando a conta não está ligada.</span></label>
          <label className="flex flex-col gap-1"><span className="label">Nota visual (0 a 10)</span><input name="visualScore" inputMode="decimal" defaultValue={p.visualScore ?? ""} placeholder="ex.: 7" className={input} /><span className="text-xs text-[var(--muted)]">Avaliação da equipe: identidade, consistência, qualidade das fotos.</span></label>
          <label className="flex flex-col gap-1"><span className="label">Observação do visual</span><input name="visualNota" defaultValue={p.visualNota ?? ""} placeholder="ex.: paleta consistente, capas sem padrão" className={input} /></label>
        </section>
        {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
          <section key={g} className="card p-5 flex flex-col gap-4">
            <h2 className="font-semibold">{GROUPS[g]}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {PROFILE_FIELDS.filter((f) => f.group === g).map((f) => (
                <label key={f.key} className={`flex flex-col gap-1 ${f.rows >= 4 ? "md:col-span-2" : ""}`}>
                  <span className="label inline-flex items-center gap-1.5">{String(p[f.key] ?? "").trim() ? <CheckIcon /> : null}{f.label}</span>
                  <textarea name={f.key} rows={f.rows} defaultValue={String(p[f.key] ?? "")} className={input} />
                  <span className="text-xs text-[var(--muted)]">{f.hint}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
        <div className="card flex items-center gap-3 sticky bottom-3 p-3 shadow-sm">
          <button className="ct-btn ct-btn-dark">Salvar perfil</button>
          {p.updatedAt && <span className="text-xs text-[var(--muted)]">Última edição: {when(p.updatedAt)} por {p.updatedBy}</span>}
        </div>
      </ActionForm>
    </Shell>
  );
}
