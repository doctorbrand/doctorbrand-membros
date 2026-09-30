import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { DeleteIconButton } from "@/components/content/ContentActions";
import { Shell } from "@/components/Shell";
import { NextStep } from "@/components/evolucao/NextStep";
import { ArrowRightIcon, CheckIcon, EyeIcon, LockIcon, SparkIcon, TargetIcon, TrophyIcon } from "@/components/Icons";
import { ADS_CLIENTS, getAds } from "@/lib/ads";
import { requireAuth } from "@/lib/auth";
import { getWork, WORK_LABEL, type WorkSummary } from "@/lib/clickup";
import { getClient } from "@/lib/clients";
import { getPosts } from "@/lib/content";
import { badges, krValue, metasDone, METODO, quarterLabel, quarterMonths, quarterOf, type KrContext } from "@/lib/evolucao";
import { todayISO } from "@/lib/periods";
import { calendarAliases, getProject, META_FONTES, type Project } from "@/lib/project";
import { addKrAction, deleteKrAction, saveEvolucaoAction, saveObjetivoAction, updateKrAction } from "../actions";

export const dynamic = "force-dynamic";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dayShort = (iso: string) => `${iso.slice(8, 10)} ${MES[Number(iso.slice(5, 7)) - 1]}`;
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Sem etapa marcada pela equipe, estima pelo andamento do projeto. */
function estimateEtapa(p: Project, work: WorkSummary | null, hasAds: boolean): number {
  const done = (re: RegExp) => p.steps.some((s) => s.status === "concluida" && re.test(s.title));
  const has = (c: string) => (work?.byCat.find((x) => x.cat === c)?.count ?? 0) > 0;
  let e = 0;
  if (done(/onboarding|diagn/i)) e = 1;
  if (done(/acesso/i)) e = Math.max(e, 1);
  if (done(/roteiro|posicion|narrativ|dossi/i) || has("roteiro")) e = 2;
  if (done(/identidade|moodboard|captac/i) || has("captacao")) e = 3;
  if (has("planejamento") || done(/planejamento/i)) e = 4;
  if (hasAds) e = 5;
  return e;
}

export default async function EvolucaoPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ visao?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  const asClient = session.role === "admin" && sp.visao === "cliente";
  const admin = session.role === "admin" && !asClient;
  const c = await getClient(slug);
  if (!c) notFound();

  const today = todayISO();
  const project = await getProject(slug);
  const names = [c.name, ...calendarAliases(slug, project)];
  const hasAds = ADS_CLIENTS.has(slug);
  const [workRes, posts, ads] = await Promise.all([getWork(names, project.clickupFolder, today), getPosts(slug), hasAds ? getAds(slug, "mes") : Promise.resolve(null)]);
  const work = workRes.ok ? workRes.data : null;

  // Metas do trimestre: números automáticos do trimestre corrente.
  const q = project.metas?.periodo ?? quarterOf(today);
  const qMonths = quarterMonths(q);
  const inQ = (d: string) => qMonths.some((m) => d.startsWith(m));
  const ctx: KrContext = {
    entregas: work ? work.doneDates.filter((d) => inQ(d.date)).length : null,
    posts: posts.filter((p) => inQ(p.date) && (p.status === "publicado" || (p.status === "agendado" && p.date <= today))).length,
    contatos: ads?.ok ? ads.data.months.filter((m) => inQ(m.month)).reduce((a, m) => a + m.results, 0) : null,
  };
  const contatosTotal = ads?.ok ? ads.data.months.reduce((a, m) => a + m.results, 0) : null;
  const etapaSet = project.metodoEtapa !== undefined;
  const etapa = project.metodoEtapa ?? estimateEtapa(project, work, hasAds);
  const list = badges({ work, etapa, metasBatidas: metasDone(project.metas, ctx), contatosTotal, today });
  const earned = list.filter((b) => b.earned);
  const locked = list.filter((b) => !b.earned).slice(0, 4);

  const maxMonth = Math.max(1, ...(work?.months ?? []).map((m) => m.count));
  const since = work?.since ? `${MES[Number(work.since.slice(5, 7)) - 1]} de ${work.since.slice(0, 4)}` : null;

  return (
    <Shell active="evolucao" session={session} clientSlug={slug}>
      {asClient && (
        <div className="card p-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ background: "#fff7e0" }}>
          <span><b>Você está vendo como {c.name} vê.</b></span>
          <Link href={`/cliente/${slug}/evolucao`} className="ct-btn">Voltar à visão da equipe</Link>
        </div>
      )}

      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Sua evolução</p>
          <h1 className="mt-1.5">Tudo o que já construímos. <i>E o que vem agora.</i></h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">{since ? `Desde ${since}, cada roteiro, captação e peça que a equipe DoctorBrand entregou para a sua marca.` : "Cada roteiro, captação e peça que a equipe DoctorBrand entrega para a sua marca."}</p>
        </div>
        {admin && <div className="ct-hero-actions"><Link href={`/cliente/${slug}/evolucao?visao=cliente`} className="ct-btn inline-flex items-center gap-1.5"><EyeIcon /> Ver como o cliente</Link></div>}
      </section>

      {/* Números */}
      {work ? (
        <div className="ev-kpis">
          <div className="card ev-total">
            <span className="label">Entregas concluídas</span>
            <b>{work.done}</b>
            <span className="text-[13px] text-[var(--muted)]">{work.open > 0 ? `e ${work.open} em produção agora` : "tudo em dia"}</span>
          </div>
          {work.byCat.filter((x) => x.cat !== "outra").slice(0, 5).map((x) => (
            <div key={x.cat} className="card ev-kpi"><b>{x.count}</b><span>{WORK_LABEL[x.cat].many}</span></div>
          ))}
        </div>
      ) : (
        <section className="card p-5 mb-4">
          <p className="font-medium">O histórico de entregas aparece aqui em breve.</p>
          {admin && <p className="text-[12.5px] text-[var(--muted)] mt-1">Equipe: {!workRes.ok && workRes.message}{!workRes.ok && workRes.reason === "sem-pasta" ? " Informe o número da pasta abaixo, em Ligação com o ClickUp." : ""}{!workRes.ok && workRes.reason === "off" ? " Crie um token pessoal no ClickUp (Settings, Apps) e salve como CLICKUP_API_TOKEN no Vercel." : ""}</p>}
        </section>
      )}

      <div className="pj-grid mt-4">
        <div className="flex flex-col gap-4 min-w-0">
          {/* Jornada D.O.M.Í.N.I.O. */}
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="pj-h2">Sua jornada no método</h2>
              <span className="text-[13px] text-[var(--muted)]">Etapa {etapa + 1} de 7</span>
            </div>
            <ol className="ev-path mt-4" aria-label="Método D.O.M.Í.N.I.O.">
              {METODO.map((m, i) => (
                <li key={i} className={i < etapa ? "is-done" : i === etapa ? "is-now" : ""}>
                  <span className="ev-path-dot">{i < etapa ? <CheckIcon size={12} /> : m.letra}</span>
                  <span className="ev-path-name">{m.nome}</span>
                </li>
              ))}
            </ol>
            <div className="ev-now mt-4">
              <span className="label">Agora</span>
              <p className="font-medium mt-0.5">{METODO[etapa].nome}</p>
              <p className="text-[13.5px] text-[var(--muted)]">{METODO[etapa].texto}</p>
              {etapa < 6 && <p className="text-[13px] text-[var(--muted)] mt-2">A seguir: <b className="font-medium text-[var(--ink)]">{METODO[etapa + 1].nome}</b>. {METODO[etapa + 1].texto}</p>}
            </div>
            {admin && !etapaSet && <p className="text-[12.5px] text-[var(--muted)] mt-3">Etapa estimada pelo andamento do projeto. Confirme em Ligação com o ClickUp e método, ao lado.</p>}
          </section>

          {/* Metas do trimestre */}
          {(admin || (project.metas && project.metas.krs.length > 0)) && (
            <section className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="pj-h2">Metas do trimestre</h2>
                <span className="text-[13px] text-[var(--muted)]">{quarterLabel(q)}</span>
              </div>
              {project.metas ? (
                <>
                  <div className="ev-goal mt-3"><TargetIcon size={18} /><p>{project.metas.objetivo}</p></div>
                  <ul className="mt-2 flex flex-col">
                    {project.metas.krs.map((k) => {
                      const v = krValue(k, ctx);
                      const pct = v === null ? 0 : Math.min(100, (v / k.alvo) * 100);
                      const hit = v !== null && v >= k.alvo;
                      return (
                        <li key={k.id} className="pj-deliv">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block font-medium">{k.titulo}</span>
                              <span className="block text-[12.5px] text-[var(--muted)]">{k.fonte === "manual" ? "Atualizada pela equipe" : `Conta sozinha: ${META_FONTES.find((f) => f.key === k.fonte)!.label.toLowerCase()}`}</span>
                            </span>
                            <span className={`pj-count ${hit ? "is-done" : v ? "is-part" : ""}`}>{v === null ? "–" : fmt(v)}<span>/{fmt(k.alvo)}</span></span>
                          </div>
                          <div className="pj-bar"><span style={{ width: `${pct}%` }} className={hit ? "is-done" : ""} /></div>
                          {admin && (
                            <details className="pj-edit mt-2">
                              <summary className="pj-edit-toggle">Editar</summary>
                              <div className="pj-edit-row mt-2">
                                <KrForm action={updateKrAction.bind(null, slug, k.id)} kr={k} />
                                <DeleteIconButton action={deleteKrAction.bind(null, slug, k.id)} confirm={`Excluir a meta "${k.titulo}"?`} label={`Excluir ${k.titulo}`} />
                              </div>
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {project.metas.krs.length === 0 && <p className="text-sm text-[var(--muted)] mt-2">Nenhuma meta ainda.</p>}
                </>
              ) : <p className="text-sm text-[var(--muted)] mt-3">Defina o objetivo do trimestre e até 5 metas. O cliente vê o progresso e ganha o selo quando bate todas.</p>}
              {admin && (
                <details className="pj-edit mt-4">
                  <summary className="pj-edit-toggle">{project.metas ? "Objetivo e nova meta" : "Definir objetivo do trimestre"}</summary>
                  <ActionForm action={saveObjetivoAction.bind(null, slug)} className="flex flex-col gap-2 mt-3">
                    <input type="hidden" name="periodo" value={project.metas?.periodo === quarterOf(today) ? project.metas.periodo : quarterOf(today)} />
                    <textarea name="objetivo" defaultValue={project.metas?.objetivo} rows={2} placeholder="Ex.: Ser a referência em rinoplastia preservadora no Rio" className="ct-input" required />
                    <button className="ct-btn ct-btn-dark self-start">Salvar objetivo ({quarterLabel(quarterOf(today))})</button>
                  </ActionForm>
                  {project.metas && project.metas.krs.length < 5 && (
                    <div className="mt-3"><KrForm action={addKrAction.bind(null, slug)} /></div>
                  )}
                </details>
              )}
            </section>
          )}

          {/* Linha do tempo */}
          {work && (
            <section className="card p-5">
              <h2 className="pj-h2">Entregas por mês</h2>
              <div className="ev-months mt-4">
                {work.months.map((m) => (
                  <div key={m.month} className="ad-month">
                    <span className="ad-month-v">{m.count || ""}</span>
                    <span className="ad-month-bar ev-bar"><span style={{ height: `${m.count ? Math.max(4, (m.count / maxMonth) * 100) : 0}%` }} /></span>
                    <span className="ad-month-l text-[11.5px] text-[var(--muted)]">{MES[Number(m.month.slice(5, 7)) - 1]}</span>
                  </div>
                ))}
              </div>
              {work.recent.length > 0 && (
                <>
                  <p className="label mt-5 mb-1">Últimas entregas</p>
                  <ul className="flex flex-col">
                    {work.recent.map((r, i) => (
                      <li key={i} className="pj-date">
                        <span className="pj-date-day text-[var(--muted)] font-medium">{dayShort(r.date)}</span>
                        <span className="min-w-0 flex items-center gap-2">
                          <span className="truncate flex-1">{r.title}</span>
                          <span className="ev-tag">{WORK_LABEL[r.cat].one}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {/* Conquistas */}
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="pj-h2">Conquistas</h2>
              <span className="text-[13px] text-[var(--muted)]">{earned.length} {earned.length === 1 ? "selo" : "selos"}</span>
            </div>
            {earned.length > 0 && (
              <div className="ev-badges mt-3">
                {earned.map((b) => (
                  <div key={b.id} className="ev-badge is-on">
                    <span className="ev-badge-ic"><TrophyIcon size={18} /></span>
                    <span className="min-w-0"><span className="block font-medium text-[14px]">{b.title}</span><span className="block text-[12.5px] text-[var(--muted)]">{b.text}</span></span>
                  </div>
                ))}
              </div>
            )}
            {locked.length > 0 && (
              <>
                <p className="label mt-4 mb-2">Próximas conquistas</p>
                <div className="ev-badges">
                  {locked.map((b) => (
                    <div key={b.id} className="ev-badge">
                      <span className="ev-badge-ic"><LockIcon /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-[14px]">{b.title}</span>
                        <span className="pj-bar"><span style={{ width: `${Math.min(100, (b.value / b.target) * 100)}%` }} /></span>
                        <span className="block text-[12px] text-[var(--muted)] mt-1">{b.id.startsWith("tempo") ? `faltam ${b.target - b.value} dias` : b.id === "metas" ? "bata todas as metas do trimestre" : `${fmt(b.value)} de ${fmt(b.target)}`}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Em produção */}
          {work && work.now.length > 0 && (
            <section className="card p-5">
              <h2 className="pj-h2">Em produção agora</h2>
              <ul className="mt-2 flex flex-col">
                {work.now.map((r, i) => (
                  <li key={i} className="pj-step">
                    <span className="pj-step-ic s-andamento" aria-hidden />
                    <span className="min-w-0 flex-1"><span className="block">{r.title}</span><span className="block text-[12.5px] text-[var(--muted)]">{WORK_LABEL[r.cat].one}{/aprova/i.test(r.status) ? " · aguardando sua aprovação" : ""}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <NextStep plano={project.plano} whatsapp={project.whatsapp} clientName={c.name} />

          <Link href={`/ajuda${session.role === "admin" ? `?c=${slug}` : ""}`} className="card p-5 pj-contact">
            <span className="pj-mat-ic"><SparkIcon /></span>
            <span className="min-w-0 flex-1"><span className="block font-medium">Central de Ajuda</span><span className="block text-[13px] text-[var(--muted)]">Como aprovar, se preparar para a captação e entender os números.</span></span>
            <ArrowRightIcon className="text-[var(--muted)]" />
          </Link>

          {admin && (
            <details className="card p-5 pj-edit">
              <summary className="pj-edit-toggle">Ligação com o ClickUp e método</summary>
              <p className="text-[12.5px] text-[var(--muted)] mt-2">{work ? <>Lendo a pasta <b>{work.folder}</b>. {work.hidden} tarefas internas não aparecem para o cliente.</> : !workRes.ok ? workRes.message : ""}</p>
              <ActionForm action={saveEvolucaoAction.bind(null, slug)} className="flex flex-col gap-2 mt-3">
                <label className="flex flex-col gap-1"><span className="label">Etapa do método</span>
                  <select name="etapa" defaultValue={etapa} className="ct-input">
                    {METODO.map((m, i) => <option key={i} value={i}>{i + 1}. {m.nome}</option>)}
                  </select></label>
                <label className="flex flex-col gap-1"><span className="label">Pasta do ClickUp (número)</span>
                  <input name="clickup" defaultValue={project.clickupFolder} inputMode="numeric" placeholder="Só se o nome não bater sozinho" className="ct-input" />
                  <span className="text-[12px] text-[var(--muted)]">O número aparece no endereço da pasta no ClickUp. Em branco, procura pelo nome do cliente.</span></label>
                <button className="ct-btn ct-btn-dark self-start">Salvar</button>
              </ActionForm>
            </details>
          )}
        </div>
      </div>
    </Shell>
  );
}

function KrForm({ action, kr }: { action: Parameters<typeof ActionForm>[0]["action"]; kr?: { titulo: string; alvo: number; atual: number; fonte: string } }) {
  return (
    <ActionForm action={action} className="ev-kr-form">
      <input name="titulo" defaultValue={kr?.titulo} placeholder="Meta (ex.: Publicar 36 posts)" className="ct-input" required />
      <select name="fonte" defaultValue={kr?.fonte ?? "manual"} className="ct-input" aria-label="De onde vem o número">
        {META_FONTES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
      <input name="alvo" type="number" min={1} step="any" defaultValue={kr?.alvo} placeholder="Alvo" className="ct-input" required aria-label="Alvo" />
      <input name="atual" type="number" min={0} step="any" defaultValue={kr?.atual} placeholder="Atual (se manual)" className="ct-input" aria-label="Valor atual" />
      <button className="ct-btn ct-btn-dark">{kr ? "Salvar" : "Adicionar meta"}</button>
    </ActionForm>
  );
}

