import Link from "next/link";
import { Shell } from "@/components/Shell";
import { HelpSearch } from "@/components/help/HelpSearch";
import { ArrowRightIcon, BookIcon, RocketIcon, SparkIcon } from "@/components/Icons";
import { requireAuth } from "@/lib/auth";
import { ARTICLES, HELP_CATS, searchText } from "@/lib/help";

export const dynamic = "force-dynamic";

const CAT_ICON = { "primeiros-passos": <RocketIcon />, tutoriais: <SparkIcon />, conhecimento: <BookIcon /> };

export default async function AjudaPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const session = await requireAuth();
  const { c } = await searchParams;
  const slug = session.role === "cliente" ? session.clientSlug : c;
  const suffix = session.role === "admin" && c ? `?c=${c}` : "";
  const items = ARTICLES.map((a) => ({ id: a.id, title: a.title, summary: a.summary, cat: HELP_CATS.find((k) => k.key === a.cat)!.label, text: searchText(a) }));
  return (
    <Shell active="ajuda" session={session} clientSlug={slug}>
      <section className="hc-hero">
        <p className="label">Central de Ajuda</p>
        <h1 className="mt-1.5">Como podemos ajudar?</h1>
        <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl mx-auto">Tutoriais, primeiros passos e tudo sobre o método, os números e os planos DoctorBrand.</p>
        <HelpSearch items={items} suffix={suffix} />
      </section>

      <div className="hc-cats">
        {HELP_CATS.map((cat) => (
          <section key={cat.key} className="card p-5">
            <div className="flex items-center gap-3">
              <span className="pj-mat-ic hc-cat-ic">{CAT_ICON[cat.key]}</span>
              <span className="min-w-0"><h2 className="pj-h2">{cat.label}</h2><p className="text-[13px] text-[var(--muted)]">{cat.text}</p></span>
            </div>
            <ul className="mt-3 flex flex-col">
              {ARTICLES.filter((a) => a.cat === cat.key).map((a) => (
                <li key={a.id}>
                  <Link href={`/ajuda/${a.id}${suffix}`} className="hc-link">
                    <span className="min-w-0 flex-1"><span className="block font-medium">{a.title}</span><span className="block text-[13px] text-[var(--muted)]">{a.summary}</span></span>
                    <ArrowRightIcon size={15} className="text-[var(--muted)] flex-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-center text-[13.5px] text-[var(--muted)] mt-8">Não achou o que procurava? Fale com a equipe pelo WhatsApp do seu projeto.</p>
    </Shell>
  );
}
