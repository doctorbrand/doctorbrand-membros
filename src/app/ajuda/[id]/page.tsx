import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ArrowRightIcon, ChevronLeftIcon, ClockIcon } from "@/components/Icons";
import { requireAuth } from "@/lib/auth";
import { article, ARTICLES, HELP_CATS } from "@/lib/help";

export const dynamic = "force-dynamic";

export default async function ArtigoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string }> }) {
  const session = await requireAuth();
  const { id } = await params;
  const { c } = await searchParams;
  const a = article(id);
  if (!a) notFound();
  const slug = session.role === "cliente" ? session.clientSlug : c;
  const suffix = session.role === "admin" && c ? `?c=${c}` : "";
  const cat = HELP_CATS.find((k) => k.key === a.cat)!;
  const related = ARTICLES.filter((x) => x.cat === a.cat && x.id !== a.id).slice(0, 3);
  return (
    <Shell active="ajuda" session={session} clientSlug={slug}>
      <article className="hc-article">
        <Link href={`/ajuda${suffix}`} className="pj-more"><ChevronLeftIcon size={15} /> Central de Ajuda</Link>
        <p className="label mt-6">{cat.label}</p>
        <h1 className="hc-title">{a.title}</h1>
        <p className="text-[16px] text-[var(--muted)] mt-2">{a.summary}</p>
        <p className="text-[12.5px] text-[var(--muted)] mt-3 inline-flex items-center gap-1.5"><ClockIcon /> {a.minutes} min de leitura</p>
        <div className="hc-body">
          {a.body.map((b, i) =>
            "h" in b ? <h2 key={i}>{b.h}</h2>
            : "p" in b ? <p key={i}>{b.p}</p>
            : "note" in b ? <p key={i} className="hc-note">{b.note}</p>
            : "list" in b ? <ul key={i}>{b.list.map((x) => <li key={x}>{x}</li>)}</ul>
            : <ol key={i}>{b.steps.map((x) => <li key={x}>{x}</li>)}</ol>,
          )}
        </div>
        {related.length > 0 && (
          <section className="mt-10">
            <p className="label mb-2">Leia também</p>
            <div className="card">
              {related.map((r) => (
                <Link key={r.id} href={`/ajuda/${r.id}${suffix}`} className="hc-link px-5">
                  <span className="min-w-0 flex-1"><span className="block font-medium">{r.title}</span><span className="block text-[13px] text-[var(--muted)]">{r.summary}</span></span>
                  <ArrowRightIcon size={15} className="text-[var(--muted)] flex-none" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </Shell>
  );
}
