import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionButton, DeleteIconButton, IconAction } from "@/components/content/ContentActions";
import { Shell } from "@/components/Shell";
import { autoSource, Deliverables } from "@/components/project/Deliverables";
import { Agenda, type DateItem } from "@/components/project/Agenda";
import { ADS_CLIENTS, brl, CPL_LABEL, getAds, gradeCpl, int } from "@/lib/ads";
import { agendaWindow, clientMeetings, meetingDate, type Meeting } from "@/lib/agenda";
import { SparkIcon, ArrowRightIcon, ArrowUpRightIcon, BookIcon, CalendarIcon, ChatIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, DocIcon, EyeIcon, GlobeIcon, FolderIcon, GridIcon, LayersIcon, LinkIcon, PaletteIcon, StoriesIcon, VideoIcon } from "@/components/Icons";
import { requireAuth } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { dayLabel, getPlan, getPosts, mediaUrl, scheduleOrder, thumbOf, TYPE_LABEL, visibleTo } from "@/lib/content";
import { todayISO } from "@/lib/periods";
import { getCrm, getWork } from "@/lib/clickup";
import { clientContract } from "@/lib/zapsign";
import { acessosDoPlano, getOnboarding, progresso } from "@/lib/onboarding";
import { planKey } from "@/lib/plans";
import { getCircle, nivelDe } from "@/lib/circle";
import { contratoStatus, dataCurta } from "@/lib/contrato";
import { getNps, grupo, GRUPO_LABEL, npsPendente, respondeuRecente, ultima } from "@/lib/nps";
import { ContractCard } from "@/components/project/ContractCard";
import { NpsCard } from "@/components/project/NpsCard";
import { METODO } from "@/lib/evolucao";
import { NextStep } from "@/components/evolucao/NextStep";
import { arrangeMaterials, calendarAliases, getProject, MATERIAL_SLOTS, STEP_LABEL, type MaterialKind, type MaterialSlot, type ProjectStep } from "@/lib/project";
import { saveContratoAction, addMaterialAction, addStepAction, applyDefaultStepsAction, deleteMaterialAction, deleteStepAction, moveStepAction, saveProjectInfoAction, updateStepAction } from "./actions";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<MaterialKind, React.ReactNode> = {
  pasta: <FolderIcon />, identidade: <PaletteIcon />, guidelines: <BookIcon />, moodboard: <GridIcon />, roteiro: <VideoIcon />,
  planejamento: <LayersIcon />, stories: <StoriesIcon />, site: <GlobeIcon />, links: <LinkIcon />, documento: <DocIcon />,
};
const SLOT_ICON: Record<MaterialSlot, React.ReactNode> = {
  pasta: <FolderIcon />, identidade: <PaletteIcon />, guia: <BookIcon />, roteiros: <VideoIcon />, planejamento: <LayersIcon />, site: <GlobeIcon />,
};

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return "";
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "").replace(" de ", " ");
}

export default async function ProjetoPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ visao?: string; mes?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  const asClient = session.role === "admin" && sp.visao === "cliente";
  const admin = session.role === "admin" && !asClient;
  const c = await getClient(slug);
  if (!c) notFound();

  const [project, all, plan, ads] = await Promise.all([getProject(slug), getPosts(slug), getPlan(slug), ADS_CLIENTS.has(slug) ? getAds(slug, "30d") : Promise.resolve(null)]);
  const posts = all.filter((p) => visibleTo(p, admin ? "admin" : "cliente"));
  const waiting = posts.filter((p) => p.status === "aguardando").length;
  const approved = posts.filter((p) => p.status === "aprovado").length;
  const scheduled = scheduleOrder(posts.filter((p) => p.status === "agendado"));
  const nextPost = scheduled[0];
  const q = asClient ? "?visao=cliente" : "";
  const conteudo = `/cliente/${slug}/conteudo${q}`;

  const steps = project.steps;
  const done = steps.filter((s) => s.status === "concluida").length;
  const doing = steps.filter((s) => s.status === "andamento");
  const next = steps.filter((s) => s.status === "nao_iniciada");
  const finished = steps.filter((s) => s.status === "concluida");
  const today = todayISO();
  const dates: DateItem[] = [
    ...steps.filter((s) => s.due && s.due >= today && s.status !== "concluida").map((s) => ({ key: s.id, date: s.due!, title: s.title, sub: "Etapa do projeto" })),
    ...scheduled.slice(0, 3).map((p) => ({ key: p.id, date: `${p.date}T${p.time || "12:00"}:00-03:00`, title: p.title, sub: `${p.time} · ${TYPE_LABEL[p.type]}`, badge: "Publicação" })),
  ];

  // Entregas do mês: posts do feed contam sozinhos; o resto a equipe registra.
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? "") && sp.mes! <= today.slice(0, 7) ? sp.mes! : today.slice(0, 7);
  const [my, mm] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(my, mm, 0)).getUTCDate();
  const feedPosts = posts.filter((p) => p.date.startsWith(month) && ["publicado", "agendado", "aprovado"].includes(p.status));
  const auto = posts.length > 0 ? { title: "Posts no feed", done: feedPosts.length, expected: Math.max(1, Math.round((plan.postsPerWeek * daysInMonth) / 7)), dates: [] as string[] } : null;
  // Agenda do Google (reuniões, captações, onboarding) só deste cliente.
  const { nowIso, from: fromD, to: toD } = agendaWindow(month);
  let meetings: Meeting[] | null = null;
  let agendaError: string | undefined;
  try { meetings = await clientMeetings(c.name, calendarAliases(slug, project), fromD, toD); } catch (e) { agendaError = e instanceof Error ? e.message : String(e); meetings = []; }
  const fromCalendar: Record<string, string[]> = {};
  for (const d of project.deliverables ?? []) {
    const src = autoSource(d.title);
    if (!src || !meetings) continue;
    const hits = meetings.filter((m) => m.start <= nowIso && meetingDate(m.start).startsWith(month) && (src === "captacao" ? m.kind === "captacao" : /planejamento/i.test(m.title)));
    fromCalendar[d.id] = [...new Set(hits.map((m) => meetingDate(m.start)))];
  }
  const mesHref = (ym: string) => `/cliente/${slug}?${asClient ? "visao=cliente&" : ""}mes=${ym}#entregas`;

  const mats = arrangeMaterials(project.materials);
  const names = [c.name, ...calendarAliases(slug, project)];
  const [work, crm, nps, zs, onb, circle] = await Promise.all([getWork(names, project.clickupFolder, today), getCrm(names), getNps(slug), clientContract(names, project.contrato?.zapsign), getOnboarding(slug), getCircle()]);
  const pk = planKey(project.plano);
  const onbPr = progresso(onb, acessosDoPlano(pk === "growth" || pk === "black"));
  const circleNivel = nivelDe(circle.indicacoes, slug);
  const circleCount = circle.indicacoes.filter((i) => i.slug === slug).length;
  const contrato = contratoStatus(project.contrato?.inicio || !zs?.doc.signedAt ? project.contrato : { ...project.contrato, inicio: zs.doc.signedAt }, today, crm?.desde, crm?.renovacao);
  const npsLast = ultima(nps);
  const showNps = !admin && npsPendente(nps, contrato.desde);
  const firstName = session.role === "cliente" ? session.name.split(" ")[0] : c.name.split(" ")[0];
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;

  return (
    <Shell active="projeto" session={session} clientSlug={slug}>
      {asClient && (
        <div className="card p-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ background: "#fff7e0" }}>
          <span><b>Você está vendo como {c.name} vê.</b> Os controles da equipe ficam escondidos.</span>
          <Link href={`/cliente/${slug}`} className="ct-btn">Voltar à visão da equipe</Link>
        </div>
      )}

      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">{project.plano ? `Projeto DoctorBrand · Plano ${project.plano}` : "Projeto DoctorBrand"}</p>
          <h1 className="mt-1.5">Olá, {firstName}. <i>Este é o seu projeto.</i></h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">O que já fizemos, o que está em andamento e tudo o que entregamos, num lugar só.</p>
        </div>
        <div className="ct-hero-actions">
          {waiting > 0
            ? <Link href={conteudo} className="ct-btn ct-btn-primary ct-btn-lg">{waiting === 1 ? "Aprovar 1 post" : `Aprovar ${waiting} posts`} <ArrowRightIcon /></Link>
            : <Link href={conteudo} className="ct-btn ct-btn-lg">Ver o planejamento <ArrowRightIcon /></Link>}
          {admin && <Link href={`/cliente/${slug}?visao=cliente`} className="ct-btn inline-flex items-center gap-1.5"><EyeIcon /> Ver como o cliente</Link>}
        </div>
      </section>

      <div className="pj-grid">
        <div className="flex flex-col gap-4 min-w-0">
          {(!onbPr.completo || admin) && (
            <Link href={`/cliente/${slug}/onboarding${q}`} className={`card p-5 pj-evo ${!onbPr.completo && !admin ? "pj-onb" : ""}`}>
              <span className="min-w-0 flex-1">
                <span className="label block">Onboarding · acessos e briefing</span>
                <span className="block mt-1 font-medium">{onbPr.completo ? "Completo" : `${onbPr.pct}% concluído`} <span className="text-[13px] font-normal text-[var(--muted)]">· {onbPr.feitos} de {onbPr.total} acessos{admin && onbPr.feitos > onbPr.confirmados ? ` (${onbPr.feitos - onbPr.confirmados} para confirmar)` : ""} · briefing {onbPr.briefing ? "enviado" : "pendente"}</span></span>
                <span className="pj-bar"><span style={{ width: `${onbPr.pct}%` }} className={onbPr.completo ? "is-done" : ""} /></span>
              </span>
              <ArrowRightIcon className="text-[var(--muted)] flex-none" />
            </Link>
          )}

          {/* Conteúdo */}
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="pj-h2">Conteúdo</h2>
              <Link href={conteudo} className="pj-more">Abrir planejamento <ArrowRightIcon size={14} /></Link>
            </div>
            <div className="pj-stats mt-4">
              <Link href={conteudo} className={`pj-stat ${waiting ? "is-attn" : ""}`}><b>{waiting}</b><span>Para aprovar</span></Link>
              <div className="pj-stat"><b>{approved}</b><span>Aprovados</span></div>
              <div className="pj-stat"><b>{scheduled.length}</b><span>Agendados</span></div>
            </div>
            {nextPost && (() => {
              const t = thumbOf(nextPost);
              return (
                <Link href={`/cliente/${slug}/conteudo?${asClient ? "visao=cliente&" : ""}post=${nextPost.id}#post`} className="pj-next mt-4">
                  {t ? <img src={mediaUrl(t, 160)} alt="" /> : <span className="pj-next-ph" />}
                  <span className="min-w-0">
                    <span className="label block">Próxima publicação</span>
                    <span className="block font-medium truncate">{nextPost.title}</span>
                    <span className="block text-[13px] text-[var(--muted)]">{dayLabel(nextPost.date, nextPost.time)} · {TYPE_LABEL[nextPost.type]}</span>
                  </span>
                </Link>
              );
            })()}
          </section>

          {ads?.ok && (() => {
            const t = ads.data.totals;
            const g = gradeCpl(t.cpl, ads.data.client);
            return (
              <section className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="pj-h2">Anúncios <span className="text-[13px] font-normal text-[var(--muted)]">· últimos 30 dias</span></h2>
                  <Link href={`/cliente/${slug}/anuncios${q}`} className="pj-more">Ver anúncios <ArrowRightIcon size={14} /></Link>
                </div>
                <div className="pj-stats mt-4">
                  <div className="pj-stat"><b>{brl(t.spend, 0)}</b><span>Investimento</span></div>
                  {t.captacao > 0 ? <>
                    <div className="pj-stat"><b>{int(t.captacao)}</b><span>Contatos</span></div>
                    <div className="pj-stat"><b>{brl(t.cpl)}</b><span>{g ? CPL_LABEL[g] : "Custo por contato"}</span></div>
                  </> : <>
                    <div className="pj-stat"><b>{int(t.linkClicks)}</b><span>Cliques e visitas</span></div>
                    <div className="pj-stat"><b>{int(t.reach)}</b><span>Pessoas alcançadas</span></div>
                  </>}
                </div>
              </section>
            );
          })()}

          <div id="entregas" className="scroll-mt-20">
            <Deliverables slug={slug} month={month} today={today} deliverables={project.deliverables ?? []} auto={auto} admin={admin} hrefFor={mesHref} fromCalendar={fromCalendar} agendaOn={meetings !== null} />
          </div>

          {/* Andamento (o cliente só vê quando a equipe já registrou etapas) */}
          {(admin || steps.length > 0) && <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="pj-h2">Andamento do projeto</h2>
              {steps.length > 0 && <span className="text-[13px] text-[var(--muted)] mono">{done} de {steps.length}</span>}
            </div>
            {steps.length > 0 ? (
              <>
                <div className="ct-progress mt-3" role="img" aria-label={`${pct}% concluído`}><span style={{ width: `${pct}%`, background: "var(--good)" }} /></div>
                {doing.length > 0 && <StepGroup title="Em andamento" steps={doing} />}
                {next.length > 0 && <StepGroup title="A seguir" steps={next} />}
                {finished.length > 0 && (
                  <details className="pj-done mt-4">
                    <summary className="label cursor-pointer">Concluídas ({finished.length})</summary>
                    <StepList steps={finished} />
                  </details>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--muted)] mt-3">{admin ? "Nenhuma etapa ainda." : "A equipe DoctorBrand vai registrar aqui as etapas do seu projeto."}</p>
            )}

            {admin && (
              <details className="pj-edit mt-5">
                <summary className="pj-edit-toggle">Editar etapas</summary>
                <div className="flex flex-col gap-2 mt-3">
                  {steps.length === 0 && <ActionButton action={applyDefaultStepsAction.bind(null, slug)} label="Usar as etapas padrão DoctorBrand" variant="dark" />}
                  {steps.map((s, i) => (
                    <div key={s.id} className="pj-edit-row">
                      <ActionForm action={updateStepAction.bind(null, slug, s.id)} className="pj-edit-form">
                        <input name="title" defaultValue={s.title} className="ct-input" aria-label="Etapa" />
                        <select name="status" defaultValue={s.status} className="ct-input" aria-label="Status">
                          <option value="nao_iniciada">A seguir</option>
                          <option value="andamento">Em andamento</option>
                          <option value="concluida">Concluída</option>
                        </select>
                        <input name="due" type="date" defaultValue={s.due} className="ct-input" aria-label="Data" />
                        <input name="note" defaultValue={s.note} placeholder="Nota para o cliente (opcional)" className="ct-input pj-edit-note" />
                        <button className="ct-btn">Salvar</button>
                      </ActionForm>
                      <div className="flex items-center">
                        {i > 0 && <IconAction action={moveStepAction.bind(null, slug, s.id, -1)} label="Subir"><ChevronUpIcon /></IconAction>}
                        {i < steps.length - 1 && <IconAction action={moveStepAction.bind(null, slug, s.id, 1)} label="Descer"><ChevronDownIcon /></IconAction>}
                        <DeleteIconButton action={deleteStepAction.bind(null, slug, s.id)} confirm={`Excluir a etapa "${s.title}"?`} label={`Excluir ${s.title}`} />
                      </div>
                    </div>
                  ))}
                  <ActionForm action={addStepAction.bind(null, slug)} className="pj-add">
                    <input name="title" placeholder="Nova etapa" className="ct-input" required />
                    <input name="due" type="date" className="ct-input" aria-label="Data" />
                    <button className="ct-btn ct-btn-dark">Adicionar</button>
                  </ActionForm>
                </div>
              </details>
            )}
          </section>}
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {showNps && <NpsCard slug={slug} preview={asClient} />}
          {!admin && !showNps && respondeuRecente(nps) && (
            <section className="card p-5 pj-contact"><span className="pj-mat-ic"><CheckIcon /></span><span className="min-w-0"><span className="block font-medium">Obrigado pela sua resposta.</span><span className="block text-[13px] text-[var(--muted)]">A equipe já recebeu e vai usar para melhorar o seu projeto.</span></span></section>
          )}

          <Link href={`/cliente/${slug}/evolucao${q}`} className="card p-5 pj-evo">
            <span className="min-w-0 flex-1">
              <span className="label block">Evolução</span>
              {work.ok
                ? <span className="block mt-1"><b className="text-[30px] font-semibold tracking-tight tabular-nums">{work.data.done}</b> <span className="text-[14px] text-[var(--muted)]">entregas concluídas{project.metodoEtapa !== undefined ? ` · etapa ${METODO[project.metodoEtapa].nome}` : ""}</span></span>
                : <span className="block mt-1 font-medium">Metas, conquistas e tudo o que já entregamos</span>}
            </span>
            <ArrowRightIcon className="text-[var(--muted)] flex-none" />
          </Link>

          <Agenda meetings={meetings} extra={dates} now={nowIso} admin={admin} error={agendaError} />

          {/* Materiais: lugares fixos, o mesmo padrão para todos os clientes */}
          {(mats.slots.length > 0 || admin) && (
            <section className="card p-5">
              <h2 className="pj-h2">Materiais do projeto</h2>
              {mats.slots.length > 0 ? (
                <div className="pj-materials mt-3">
                  {mats.slots.map((s) => (
                    <div key={s.key} className="pj-mat-wrap">
                      <a href={s.material.url} target="_blank" rel="noreferrer" className="pj-mat">
                        <span className="pj-mat-ic">{SLOT_ICON[s.key]}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium truncate">{s.label}</span>
                          <span className="block text-[12px] text-[var(--muted)] truncate">{s.material.title !== s.label ? s.material.title : s.hint}</span>
                        </span>
                        <ArrowUpRightIcon className="text-[var(--muted)] flex-none" />
                      </a>
                      {admin && <DeleteIconButton action={deleteMaterialAction.bind(null, slug, s.material.id)} confirm={`Tirar "${s.material.title}" dos materiais?`} label={`Excluir ${s.material.title}`} />}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-[var(--muted)] mt-3">Nenhum material ainda.</p>}
              {admin && (
                <>
                  {mats.others.length > 0 && (
                    <details className="pj-edit mt-4">
                      <summary className="pj-edit-toggle">Histórico e outros links ({mats.others.length}) · só a equipe vê</summary>
                      <div className="pj-materials mt-3">
                        {mats.others.map((m) => (
                          <div key={m.id} className="pj-mat-wrap">
                            <a href={m.url} target="_blank" rel="noreferrer" className="pj-mat pj-mat-sm">
                              <span className="pj-mat-ic">{KIND_ICON[m.kind] ?? <DocIcon />}</span>
                              <span className="min-w-0 flex-1"><span className="block truncate">{m.title}</span><span className="block text-[12px] text-[var(--muted)] truncate">{host(m.url)}</span></span>
                            </a>
                            <DeleteIconButton action={deleteMaterialAction.bind(null, slug, m.id)} confirm={`Tirar "${m.title}" dos materiais?`} label={`Excluir ${m.title}`} />
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  <details className="pj-edit mt-4">
                    <summary className="pj-edit-toggle">Adicionar ou trocar material</summary>
                    <ActionForm action={addMaterialAction.bind(null, slug)} className="flex flex-col gap-2 mt-3">
                      <select name="kind" className="ct-input" defaultValue="" required>
                        <option value="" disabled>Lugar</option>
                        {MATERIAL_SLOTS.map((k) => <option key={k.key} value={k.kind}>{k.label}</option>)}
                        <option value="documento">Outro link (só no histórico)</option>
                      </select>
                      <input name="title" placeholder="Descrição curta (ex.: Roteiros da captação 27/08)" className="ct-input" />
                      <input name="url" type="url" placeholder="https://" className="ct-input" required />
                      <span className="text-[12px] text-[var(--muted)]">Cada lugar mostra só o link mais recente. O anterior vai para o histórico.</span>
                      <button className="ct-btn ct-btn-dark self-start">Salvar</button>
                    </ActionForm>
                  </details>
                </>
              )}
            </section>
          )}

          {/* Contato */}
          {project.whatsapp ? (
            <a href={`https://wa.me/${project.whatsapp}`} target="_blank" rel="noreferrer" className="card p-5 pj-contact">
              <span className="pj-mat-ic"><ChatIcon /></span>
              <span className="min-w-0 flex-1"><span className="block font-medium">Fale com a equipe</span><span className="block text-[13px] text-[var(--muted)]">Dúvidas, ajustes e agenda, pelo WhatsApp.</span></span>
              <ArrowUpRightIcon className="text-[var(--muted)]" />
            </a>
          ) : null}

          <ContractCard st={contrato} plano={project.plano} hoje={today} admin={admin} zs={zs?.doc} slug={slug} />

          {admin && (
            <section className="card p-5">
              <h2 className="pj-h2">Termômetro</h2>
              {npsLast ? (
                <>
                  <p className="mt-2"><b className="text-[26px] font-semibold tracking-tight">{npsLast.score}</b> <span className={`text-[13.5px] ${grupo(npsLast.score) === "detrator" ? "g-bad" : grupo(npsLast.score) === "promotor" ? "g-good" : "g-warn"}`}>{GRUPO_LABEL[grupo(npsLast.score)]}</span> <span className="text-[13px] text-[var(--muted)]">· {dataCurta(npsLast.at.slice(0, 10))}</span></p>
                  {npsLast.comentario && <p className="text-[14px] mt-1">&ldquo;{npsLast.comentario}&rdquo;</p>}
                  {nps.respostas.length > 1 && <p className="text-[12.5px] text-[var(--muted)] mt-2">Anteriores: {nps.respostas.slice(0, -1).slice(-5).map((r) => r.score).join(", ")}</p>}
                </>
              ) : <p className="text-sm text-[var(--muted)] mt-2">Ainda sem resposta. A pergunta aparece para o cliente no Projeto a cada 90 dias.</p>}
            </section>
          )}

          <Link href={`/cliente/${slug}/indicacoes${q}`} className="card p-5 pj-contact">
            <span className="pj-mat-ic"><SparkIcon /></span>
            <span className="min-w-0 flex-1"><span className="block font-medium">Circle DoctorBrand{circleNivel ? ` · nível ${circleNivel}` : ""}</span><span className="block text-[13px] text-[var(--muted)]">{circleCount ? `${circleCount} ${circleCount === 1 ? "indicação" : "indicações"}. Indique um colega e suba de nível.` : "Indique um colega médico e conquiste acessos exclusivos."}</span></span>
            <ArrowRightIcon className="text-[var(--muted)]" />
          </Link>

          <NextStep plano={project.plano} whatsapp={project.whatsapp} clientName={c.name} compact />

          {admin && (
            <details className="card p-5 pj-edit">
              <summary className="pj-edit-toggle">Contrato</summary>
              <ActionForm action={saveContratoAction.bind(null, slug)} className="flex flex-col gap-2 mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1"><span className="label">Início</span><input name="inicio" type="date" defaultValue={project.contrato?.inicio} className="ct-input" /></label>
                  <label className="flex flex-col gap-1"><span className="label">Prazo (meses)</span><input name="meses" type="number" min={1} max={60} defaultValue={project.contrato?.meses} className="ct-input" /></label>
                </div>
                <label className="flex flex-col gap-1"><span className="label">Renovação</span>
                  <select name="regra" defaultValue={project.contrato?.regra ?? "iguais"} className="ct-input">
                    <option value="iguais">Renova sozinho por períodos iguais</option>
                    <option value="mensal">Depois do prazo, mês a mês</option>
                    <option value="nova">Precisa de contrato novo</option>
                  </select></label>
                <label className="flex flex-col gap-1"><span className="label">Próxima renovação (se quiser fixar)</span><input name="renovacao" type="date" defaultValue={project.contrato?.renovacao} className="ct-input" />
                  <span className="text-[12px] text-[var(--muted)]">Em branco, calcula pelo início e prazo{crm?.renovacao ? `, ou usa a data do ClickUp (${dataCurta(crm.renovacao)})` : ""}.</span></label>
                <label className="flex flex-col gap-1"><span className="label">Link do contrato</span><input name="url" type="url" defaultValue={project.contrato?.url} placeholder="https://drive.google.com/..." className="ct-input" />
                  <span className="text-[12px] text-[var(--muted)]">O cliente vê o botão Ver contrato. Compartilhe o arquivo com o e-mail dele no Drive.</span></label>
                {zs && zs.all.length > 0 && (
                  <label className="flex flex-col gap-1"><span className="label">Contrato na ZapSign</span>
                    <select name="zapsign" defaultValue={project.contrato?.zapsign ?? ""} className="ct-input">
                      <option value="">Automático (o mais recente assinado)</option>
                      {zs.all.map((d) => <option key={d.token} value={d.token}>{d.name} · {d.status === "signed" ? "assinado" : "pendente"} · {dataCurta(d.created)}</option>)}
                    </select></label>
                )}
                <button className="ct-btn ct-btn-dark self-start">Salvar</button>
              </ActionForm>
            </details>
          )}

          {admin && (
            <details className="card p-5 pj-edit">
              <summary className="pj-edit-toggle">Plano e contato</summary>
              <ActionForm action={saveProjectInfoAction.bind(null, slug)} className="flex flex-col gap-2 mt-3">
                <label className="flex flex-col gap-1"><span className="label">Plano</span><input name="plano" defaultValue={project.plano} placeholder="Ex.: Growth" className="ct-input" /></label>
                <label className="flex flex-col gap-1"><span className="label">WhatsApp da equipe</span><input name="whatsapp" defaultValue={project.whatsapp} inputMode="numeric" placeholder="5521999999999" className="ct-input" /></label>
                <label className="flex flex-col gap-1"><span className="label">WhatsApp do cliente (para os avisos)</span><input name="clienteWhatsapp" defaultValue={project.clienteWhatsapp} inputMode="numeric" placeholder="5521999999999" className="ct-input" />
                  <span className="text-[12px] text-[var(--muted)]">Só a equipe vê. Usado nos atalhos da página Avisos.</span></label>
                <label className="flex flex-col gap-1"><span className="label">Outros nomes na agenda</span><input name="aliases" defaultValue={(project.calendarAliases ?? []).join(", ")} placeholder={`Ex.: Dr. ${c.name.split(" ")[0]}, ${c.name.split(" ").slice(-1)[0]}`} className="ct-input" />
                  <span className="text-[12px] text-[var(--muted)]">A agenda já reconhece &quot;{c.name}&quot; e as abreviações. Separe por vírgula.</span></label>
                <button className="ct-btn ct-btn-dark self-start">Salvar</button>
              </ActionForm>
            </details>
          )}
        </div>
      </div>
    </Shell>
  );
}

function StepGroup({ title, steps }: { title: string; steps: ProjectStep[] }) {
  return (
    <div className="mt-4">
      <p className="label mb-1">{title}</p>
      <StepList steps={steps} />
    </div>
  );
}

function StepList({ steps }: { steps: ProjectStep[] }) {
  return (
    <ul className="flex flex-col">
      {steps.map((s) => (
        <li key={s.id} className="pj-step">
          <span className={`pj-step-ic s-${s.status}`} aria-label={STEP_LABEL[s.status]}>{s.status === "concluida" && <CheckIcon size={12} />}</span>
          <span className="min-w-0 flex-1">
            <span className="block">{s.title}</span>
            {s.note && <span className="block text-[13px] text-[var(--muted)]">{s.note}</span>}
          </span>
          {s.due && <span className="text-[12.5px] text-[var(--muted)] mono flex-none">{shortDate(s.due)}</span>}
        </li>
      ))}
    </ul>
  );
}
