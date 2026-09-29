import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionButton, ChangeRequest, ConnectInstagram, DeleteIconButton, ScheduleForm } from "@/components/content/ContentActions";
import { CoverPicker } from "@/components/content/CoverPicker";
import { PostEditor } from "@/components/content/PostEditor";
import { VideoPlayer } from "@/components/content/VideoPlayer";
import { ZipImport } from "@/components/content/ZipImport";
import { DriveImport } from "@/components/content/DriveImport";
import { Shell } from "@/components/Shell";
import { AlertIcon, CheckIcon, EyeIcon, MenuIcon, PencilIcon } from "@/components/Icons";
import { requireAuth } from "@/lib/auth";
import { getClient, type Client } from "@/lib/clients";
import { canScheduleAt, dayLabel, feedOrder, getPlan, getPosts, MAX_ATTEMPTS, mediaKey, mediaUrl, sameOriginVideo, scheduleOrder, STATUS_LABEL, STATUS_PILL, thumbOf, TYPE_LABEL, videoSource, visibleTo, type FeedPlan, type Post } from "@/lib/content";
import { postChecks, scoreFeed, type FeedScore } from "@/lib/feedScore";
import { igAccounts, igProfile, igRecentMedia, type IgAccount } from "@/lib/instagram";
import { publishProblem } from "@/lib/publish";
import { addDays, todayISO } from "@/lib/periods";
import { localDir } from "@/lib/store";
import { approveAllAction, approvePostAction, connectInstagramAction, disconnectInstagramAction, deletePostAction, importDriveAction, importDriveBatchAction, importPostsAction, publishNowAction, requestChangeAction, retryPublishAction, savePlanAction, savePostAction, scheduleAction, setCoverAction, setStatusAction, unscheduleAction } from "./actions";

export const dynamic = "force-dynamic";

const CAROUSEL = <svg className="ct-flag" viewBox="0 0 24 24" fill="#fff" aria-label="Carrossel"><path d="M7 3h11a3 3 0 0 1 3 3v11h-2V6a1 1 0 0 0-1-1H7z" /><rect x="3" y="7" width="14" height="14" rx="3" /></svg>;
const REEL = <svg className="ct-flag" viewBox="0 0 24 24" fill="#fff" aria-label="Reels"><path d="M8 5.5v13l11-6.5z" /></svg>;

const ACTION_LABEL: Record<string, string> = { criado: "criou", editado: "editou", enviado: "enviou para aprovação", aprovado: "aprovou", alteracao: "pediu alteração", agendado: "agendou", publicado: "publicou", voltou: "voltou o status", capa: "trocou a capa" };

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtCount(n?: number) {
  if (n === undefined) return "–";
  return n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(".", ",")} mil` : n.toLocaleString("pt-BR");
}

export default async function ConteudoPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ post?: string; novo?: string; editar?: string; visao?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  /** Equipe pode ver a página exatamente como o cliente vê (?visao=cliente). */
  const asClient = session.role === "admin" && sp.visao === "cliente";
  const admin = session.role === "admin" && !asClient;
  const role = admin ? "admin" : "cliente";
  const c = await getClient(slug);
  if (!c) notFound();

  const [all, plan, profile, live, accounts] = await Promise.all([getPosts(slug), getPlan(slug), igProfile(c.igUserId), igRecentMedia(c.igUserId, 15), admin ? igAccounts() : Promise.resolve([] as IgAccount[])]);
  const local = !!localDir();
  const nextDay = addDays(todayISO(), 1);
  const posts = all.filter((p) => visibleTo(p, role));
  const planned = posts.filter((p) => p.status !== "publicado");
  const order = scheduleOrder(planned);
  const num = new Map(order.map((p, i) => [p.id, i + 1]));
  const grid = feedOrder(planned);
  const score = scoreFeed(posts, plan, todayISO());

  const waiting = posts.filter((p) => p.status === "aguardando").length;
  const changes = posts.filter((p) => p.status === "alteracao").length;
  const approved = posts.filter((p) => p.status === "aprovado" || p.status === "agendado").length;

  const editing = admin && sp.editar ? all.find((p) => p.id === sp.editar) : undefined;
  const creating = admin && sp.novo !== undefined;
  const selected: Post | undefined = (sp.post && posts.find((p) => p.id === sp.post)) || order.find((p) => p.status === "aguardando") || order[0] || feedOrder(posts)[0];
  const base = `/cliente/${slug}/conteudo`;

  const handle = profile?.username ?? c.name.toLowerCase().replace(/\s+/g, "");
  const initials = c.name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <Shell active="conteudo" session={session} clientSlug={slug}>
      {asClient && (
        <div className="card p-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ background: "#fff7e0" }}>
          <span><b>Você está vendo como {c.name} vê.</b> Rascunhos e controles da equipe ficam escondidos.</span>
          <Link href={base} className="ct-btn">Voltar à visão da equipe</Link>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="label">{admin ? `${c.name} · ${c.specialty}` : c.specialty}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Planejamento de conteúdo</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-xl">
            {admin ? "Visão da equipe. O cliente vê tudo, menos os rascunhos." : "Veja como o seu feed vai ficar, abra cada post e aprove ou peça alteração. Nada é publicado sem a sua aprovação."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill pill-yellow">{waiting} aguardando</span>
          {changes > 0 && <span className="pill pill-red">{changes} com alteração</span>}
          <span className="pill pill-green">{approved} aprovados</span>
          {waiting > 1 && <ActionButton action={approveAllAction.bind(null, slug)} label={`Aprovar os ${waiting}`} variant="primary" confirm={`Aprovar os ${waiting} posts que estão aguardando?`} />}
          {admin && <Link href={`${base}?novo`} className="ct-btn ct-btn-dark">+ Novo post</Link>}
        </div>
      </div>

      {admin && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Link href="/conteudo" className="text-sm text-[var(--muted)]">← Todos os clientes</Link>
          <Link href={`${base}?visao=cliente`} className="ct-btn inline-flex items-center gap-1.5"><EyeIcon /> Ver como o cliente</Link>
          <ZipImport slug={slug} action={importPostsAction.bind(null, slug)} local={local} defaultStart={nextDay} everyDays={Math.max(1, Math.round(7 / plan.postsPerWeek))} />
          <DriveImport action={importDriveBatchAction.bind(null, slug)} defaultStart={nextDay} everyDays={Math.max(1, Math.round(7 / plan.postsPerWeek))} />
        </div>
      )}

      {admin && !c.igUserId && (
        <section className="card p-4 mb-4 flex flex-col gap-2">
          <p className="font-medium">Ligar o Instagram deste cliente</p>
          <p className="text-sm text-[var(--muted)]">Necessário para a prévia com os posts reais e para publicar sozinho no horário. Sem senha: usa o acesso da DoctorBrand no Business Manager.</p>
          <ConnectInstagram action={connectInstagramAction.bind(null, slug)} accounts={accounts.map((a) => ({ igUserId: a.igUserId, username: a.username, pageName: a.pageName }))} />
        </section>
      )}

      {admin && c.igUserId && (
        <details className="card p-4 mb-4">
          <summary className="cursor-pointer text-sm"><b>Instagram ligado:</b> @{profile?.username ?? c.igUserId} <span className="text-[var(--muted)] underline ml-1">editar</span></summary>
          <div className="flex flex-col gap-3 mt-3">
            <p className="text-sm text-[var(--muted)]">Ligou a conta errada? Escolha a certa e clique em Ligar. Os posts e agendamentos do cliente continuam como estão.</p>
            <ConnectInstagram action={connectInstagramAction.bind(null, slug)} accounts={accounts.filter((a) => a.igUserId !== c.igUserId).map((a) => ({ igUserId: a.igUserId, username: a.username, pageName: a.pageName }))} />
            <ActionButton action={disconnectInstagramAction.bind(null, slug)} label="Desligar o Instagram" confirm="Desligar o Instagram deste cliente? Nada publica sozinho até ligar de novo." />
          </div>
        </details>
      )}

      <div className="ct-layout">
        {/* Celular */}
        <div className="ct-phone" aria-label="Prévia do perfil no Instagram">
          <div className="ct-screen">
            <div className="ct-ig-top"><span>{handle}</span><MenuIcon /></div>
            <div className="ct-ig-head">
              {profile?.picture ? <img src={profile.picture} alt="" className="ct-avatar" /> : <div className="ct-avatar">{initials}</div>}
              <div className="ct-stats">
                <div><b>{fmtCount((profile?.mediaCount ?? live.length) + planned.length)}</b>posts</div>
                <div><b>{fmtCount(profile?.followers)}</b>seguidores</div>
                <div><b>{fmtCount(profile?.follows)}</b>seguindo</div>
              </div>
            </div>
            <div className="ct-bio"><b>{profile?.name ?? c.name}</b>{profile?.biography ?? c.specialty}</div>
            <div className="ct-grid">
              {grid.map((p) => {
                const t = thumbOf(p);
                return (
                  <Link key={p.id} href={`${base}?${asClient ? "visao=cliente&" : ""}post=${p.id}`} className={`ct-cell ${selected?.id === p.id && !creating && !editing ? "is-current" : ""}`} aria-label={`Post ${num.get(p.id)}: ${p.title}`}>
                    {t ? <img src={mediaUrl(t, 480)} alt="" loading="lazy" /> : <span className="absolute inset-0 grid place-items-center text-[11px] text-[var(--muted)]">sem capa</span>}
                    <span className="ct-num">{num.get(p.id)}</span>
                    {p.type === "carrossel" ? CAROUSEL : p.type === "reels" ? REEL : null}
                    <span className={`ct-badge s-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                  </Link>
                );
              })}
              {live.map((m) => (
                <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="ct-cell is-live" aria-label="Post já publicado">
                  {m.thumb && <img src={m.thumb} alt="" loading="lazy" />}
                  {m.type === "CAROUSEL_ALBUM" ? CAROUSEL : m.type === "VIDEO" ? REEL : null}
                </a>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-center text-white/60 py-2">Numerados: planejados · apagados: já publicados</p>
        </div>

        {/* Lado direito */}
        <div className="flex flex-col gap-4 min-w-0">
          {creating || editing ? (
            <>
              <Link href={base} className="text-sm text-[var(--muted)]">← Voltar ao planejamento</Link>
              <PostEditor slug={slug} action={savePostAction.bind(null, slug)} post={editing} defaultDate={todayISO()} pillars={plan.pillars.map((p) => p.name)} importDrive={importDriveAction} local={local} />
            </>
          ) : selected ? (
            <PostDetail post={selected} n={num.get(selected.id)} total={order.length} slug={slug} admin={admin} base={base} client={c} plan={plan} local={local} />
          ) : (
            <div className="card p-8 text-center">
              <p className="font-medium">Nenhum post planejado ainda.</p>
              <p className="text-sm text-[var(--muted)] mt-1">{admin ? "Crie o primeiro post para o cliente aprovar." : "Assim que a equipe DoctorBrand enviar o planejamento, ele aparece aqui."}</p>
              {admin && <Link href={`${base}?novo`} className="ct-btn ct-btn-dark mt-4">+ Criar primeiro post</Link>}
            </div>
          )}

          {order.length > 0 && (
            <section className="card p-3">
              <p className="label px-2 pt-1 pb-2">Ordem de publicação</p>
              {order.map((p) => {
                const t = thumbOf(p);
                return (
                  <div key={p.id} className="ct-row-wrap">
                  <Link href={`${base}?${asClient ? "visao=cliente&" : ""}post=${p.id}`} className={`ct-row ${selected?.id === p.id && !creating && !editing ? "is-current" : ""}`}>
                    <span className="n">{String(num.get(p.id)).padStart(2, "0")}</span>
                    {t ? <img src={mediaUrl(t, 160)} alt="" loading="lazy" /> : <span className="w-12 h-[60px] rounded-lg bg-[#eee]" />}
                    <span className="min-w-0">
                      <span className="label block">{TYPE_LABEL[p.type]} · {dayLabel(p.date, p.time)}</span>
                      <span className="block font-medium truncate">{p.title}</span>
                    </span>
                    <span className={`pill ${STATUS_PILL[p.status]} ct-row-status`}>{STATUS_LABEL[p.status]}</span>
                  </Link>
                  {admin && (
                    <div className="ct-row-tools">
                      <Link href={`${base}?editar=${p.id}`} title="Editar" aria-label={`Editar ${p.title}`} className="ct-icon-btn"><PencilIcon /></Link>
                      <DeleteIconButton action={deletePostAction.bind(null, slug, p.id)} confirm={`Excluir "${p.title}" do planejamento?`} label={`Excluir ${p.title}`} />
                    </div>
                  )}
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </div>

      {planned.filter((p) => p.status !== "rascunho").length >= 6 ? (
        <div className="mt-6"><ScoreCard score={score} plan={plan} admin={admin} slug={slug} /></div>
      ) : admin ? (
        <p className="text-sm text-[var(--muted)] mt-6">A pontuação do planejamento aparece quando houver pelo menos 6 posts planejados (hoje: {planned.filter((p) => p.status !== "rascunho").length}).</p>
      ) : null}
    </Shell>
  );
}

function PostDetail({ post: p, n, total, slug, admin, base, client, plan, local }: { post: Post; n?: number; total: number; slug: string; admin: boolean; base: string; client: Client; plan: FeedPlan; local: boolean }) {
  const canDecide = p.status === "aguardando" || p.status === "alteracao";
  const lastChange = [...p.history].reverse().find((h) => h.action === "alteracao");
  return (
    <section className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label">{n ? `Post ${n} de ${total} · ` : ""}{TYPE_LABEL[p.type]}{p.media.length > 1 ? ` · ${p.media.length} mídias` : ""} · {dayLabel(p.date, p.time)}</p>
          <h2 className="text-2xl font-semibold tracking-tight mt-1">{p.title}</h2>
        </div>
        <span className={`pill ${STATUS_PILL[p.status]}`}>{STATUS_LABEL[p.status]}</span>
      </div>

      {p.status === "alteracao" && lastChange?.note && (
        <div className="rounded-xl border border-[#f2c6c2] bg-[#fbeae9] p-3 text-sm">
          <b>Alteração pedida{lastChange.slide ? ` na imagem ${lastChange.slide}` : ""}:</b> {lastChange.note}
          <span className="block text-xs text-[var(--muted)] mt-1">{lastChange.by} · {fmtWhen(lastChange.at)}</span>
        </div>
      )}

      <div className="ct-slides">
        {p.media.map((m, i) => (
          <div key={mediaKey(m)} className={`ct-slide ${p.type === "reels" ? "is-reel" : ""}`}>
            {m.kind === "video"
              ? <VideoPlayer {...videoSource(m)} poster={mediaUrl(p.type === "reels" && p.cover ? p.cover : m.driveId ? m : undefined, 720)} vertical={p.type === "reels"} label={p.title} />
              : <img src={mediaUrl(m, 1080)} alt={`${p.title}, imagem ${i + 1}`} />}
            {p.media.length > 1 && <span className="ct-num">{i + 1}</span>}
          </div>
        ))}
      </div>

      {p.type === "reels" && p.media[0] && p.status !== "publicado" && sameOriginVideo(p.media[0]) && (
        <div className="flex flex-col gap-2">
          <p className="label">Capa do Reels</p>
          <CoverPicker slug={slug} postId={p.id} videoSrc={sameOriginVideo(p.media[0])!} current={mediaUrl(p.cover, 400)} setCover={setCoverAction.bind(null, slug, p.id)} local={local} />
        </div>
      )}

      <div>
        <p className="label mb-1">Legenda · {p.caption.length} caracteres</p>
        <div className="ct-caption">{p.caption || <span className="text-[var(--muted)]">Sem legenda.</span>}</div>
      </div>

      <PostChecks post={p} plan={plan} />

      {canDecide && (
        <div className="flex flex-wrap items-start gap-2">
          <ActionButton action={approvePostAction.bind(null, slug, p.id)} label="Aprovar post" variant="primary" />
          <ChangeRequest action={requestChangeAction.bind(null, slug, p.id)} slides={p.media.length} />
        </div>
      )}

      <PublishBlock post={p} slug={slug} admin={admin} client={client} />

      {admin && (
        <div className="flex flex-wrap items-start gap-2 border-t border-[var(--line)] pt-3">
          <div className="w-full flex items-center justify-between">
            <span className="label">Equipe</span>
            <span className="flex items-center gap-1">
              <Link href={`${base}?editar=${p.id}`} title="Editar" aria-label="Editar post" className="ct-icon-btn"><PencilIcon /></Link>
              <DeleteIconButton action={deletePostAction.bind(null, slug, p.id)} confirm={`Excluir "${p.title}" do planejamento?`} label="Excluir post" />
            </span>
          </div>
          {(p.status === "rascunho" || p.status === "alteracao") && <ActionButton action={setStatusAction.bind(null, slug, p.id, "aguardando")} label="Enviar para aprovação" />}
          {(p.status === "aprovado" || p.status === "agendado") && <ActionButton action={publishNowAction.bind(null, slug, p.id)} label="Publicar agora" variant="dark" confirm="Publicar agora no Instagram do cliente?" />}
          {(p.status === "aprovado" || p.status === "agendado") && <ActionButton action={setStatusAction.bind(null, slug, p.id, "publicado")} label="Já publiquei manualmente" />}
          {p.status !== "rascunho" && p.status !== "publicado" && <ActionButton action={setStatusAction.bind(null, slug, p.id, "rascunho")} label="Voltar para rascunho" />}
        </div>
      )}

      <details className="text-sm">
        <summary className="label cursor-pointer">Histórico ({p.history.length})</summary>
        <ul className="mt-2 flex flex-col gap-1.5">
          {[...p.history].reverse().map((h, i) => (
            <li key={i} className="text-[var(--muted)]">
              <span className="mono">{fmtWhen(h.at)}</span> · <b className="text-[var(--ink)] font-medium">{h.by}</b> {ACTION_LABEL[h.action] ?? h.action}
              {h.slide ? ` (imagem ${h.slide})` : ""}{h.note ? `: “${h.note}”` : ""}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function PublishBlock({ post: p, slug, admin, client }: { post: Post; slug: string; admin: boolean; client: Client }) {
  const st = p.publish;
  if (p.status === "publicado") {
    return (
      <div className="rounded-xl border border-[#bfe0cc] bg-[#e6f4ec] p-3 text-sm flex flex-wrap items-center justify-between gap-2">
        <span><b>Publicado</b>{st?.publishedAt ? ` em ${fmtWhen(st.publishedAt)}` : ""}.</span>
        {st?.permalink && <a href={st.permalink} target="_blank" rel="noreferrer" className="ct-btn">Ver no Instagram</a>}
      </div>
    );
  }
  if (p.status === "aprovado") {
    const problem = publishProblem(client, p);
    const future = canScheduleAt(p);
    return (
      <div className="border-t border-[var(--line)] pt-3 flex flex-col gap-2">
        <p className="label">Agendar publicação</p>
        {problem ? <p className="text-sm g-warn">{problem}</p> : (
          <ScheduleForm action={scheduleAction.bind(null, slug, p.id)} date={future ? p.date : ""} time={p.time} />
        )}
      </div>
    );
  }
  if (p.status === "agendado") {
    const failed = (st?.attempts ?? 0) >= MAX_ATTEMPTS;
    return (
      <div className="border-t border-[var(--line)] pt-3 flex flex-col gap-2">
        <div className="rounded-xl border border-[#d5dde6] bg-[#eef2f6] p-3 text-sm">
          <b>Agendado para {dayLabel(p.date, p.time)}.</b> Publica sozinho no Instagram{client.igUserId ? "" : " assim que a conta estiver ligada"}.
          {st?.containerId && !st.igMediaId && !st.lastError && <span className="block text-xs text-[var(--muted)] mt-1">A Meta está processando a mídia.</span>}
        </div>
        {st?.lastError && (
          <div className="rounded-xl border border-[#f2c6c2] bg-[#fbeae9] p-3 text-sm">
            <b>{failed ? `Não publicou depois de ${MAX_ATTEMPTS} tentativas.` : `Tentativa ${st.attempts} falhou, tenta de novo sozinho.`}</b>
            {admin ? <span className="block mt-1">{st.lastError}</span> : <span className="block mt-1">A equipe DoctorBrand já foi avisada.</span>}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <ActionButton action={unscheduleAction.bind(null, slug, p.id)} label="Cancelar agendamento" />
          {admin && failed && <ActionButton action={retryPublishAction.bind(null, slug, p.id)} label="Tentar de novo" />}
        </div>
        <details><summary className="label cursor-pointer">Mudar data ou hora</summary>
          <div className="mt-2"><ScheduleForm action={scheduleAction.bind(null, slug, p.id)} date={p.date} time={p.time} label="Reagendar" /></div>
        </details>
      </div>
    );
  }
  return null;
}

function PostChecks({ post, plan }: { post: Post; plan: FeedPlan }) {
  const checks = postChecks(post, plan);
  const bad = checks.filter((c) => !c.ok);
  return (
    <details className="text-sm" open={bad.some((c) => c.severity === "alta")}>
      <summary className="label cursor-pointer">Checagem do post · {bad.length ? `${bad.length} ponto${bad.length > 1 ? "s" : ""} de atenção` : "tudo certo"}</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {checks.map((c, i) => (
          <li key={i} className={c.ok ? "text-[var(--muted)]" : c.severity === "alta" ? "g-bad" : "g-warn"}><span className="inline-flex items-center gap-1.5">{c.ok ? <CheckIcon /> : <AlertIcon />} {c.label}</span></li>
        ))}
      </ul>
    </details>
  );
}

const GRADE_COLOR: Record<FeedScore["grade"], string> = { A: "var(--good)", B: "var(--ok)", C: "var(--warn)", D: "var(--bad)" };

function ScoreCard({ score, plan, admin, slug }: { score: FeedScore; plan: FeedPlan; admin: boolean; slug: string }) {
  return (
    <section className="card p-4 mb-4">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full grid place-items-center text-2xl font-semibold text-white mono" style={{ background: GRADE_COLOR[score.grade] }}>{score.total}</div>
          <div>
            <p className="label">Pontuação do planejamento</p>
            <p className="font-semibold">{score.gradeLabel}</p>
            <p className="text-xs text-[var(--muted)]">{score.count} post{score.count === 1 ? "" : "s"} · {score.window}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-1 min-w-[260px]">
          {score.items.map((i) => {
            const r = i.score / i.max;
            return (
              <div key={i.key} title={i.detail}>
                <div className="flex justify-between text-xs"><span className="text-[var(--muted)]">{i.label}</span><span className="mono">{Math.round(i.score)}/{i.max}</span></div>
                <div className="h-1.5 rounded-full bg-[#eceae5] mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(3, r * 100)}%`, background: r >= 0.85 ? "var(--good)" : r >= 0.6 ? "var(--ok)" : r >= 0.4 ? "var(--warn)" : "var(--bad)" }} /></div>
              </div>
            );
          })}
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="label cursor-pointer">O que melhorar</summary>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          {score.items.map((i) => (
            <div key={i.key}>
              <p className="font-medium">{i.label} <span className="text-[var(--muted)] font-normal">· {i.detail}</span></p>
              {i.tips.length ? <ul className="list-disc pl-5 text-[var(--muted)]">{i.tips.map((t, k) => <li key={k}>{t}</li>)}</ul> : <p className="text-[var(--muted)]">Dentro da meta.</p>}
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)] mt-3">Metas: {plan.postsPerWeek} posts/semana · Reels {plan.mix.reels}% · Carrossel {plan.mix.carrossel}% · Foto {plan.mix.imagem}%{plan.pillars.length ? ` · ${plan.pillars.map((p) => `${p.name} ${p.target}%`).join(" · ")}` : ""}.</p>
        {admin && (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <p className="label mb-2">Metas do feed (equipe)</p>
            <ActionForm action={savePlanAction.bind(null, slug)} className="grid sm:grid-cols-[repeat(5,minmax(0,1fr))] gap-3 items-end">
              <label className="flex flex-col gap-1"><span className="label">Posts/semana</span><input name="postsPerWeek" type="number" min={1} max={21} defaultValue={plan.postsPerWeek} className="ct-input" /></label>
              <label className="flex flex-col gap-1"><span className="label">Reels %</span><input name="mix_reels" type="number" min={0} max={100} defaultValue={plan.mix.reels} className="ct-input" /></label>
              <label className="flex flex-col gap-1"><span className="label">Carrossel %</span><input name="mix_carrossel" type="number" min={0} max={100} defaultValue={plan.mix.carrossel} className="ct-input" /></label>
              <label className="flex flex-col gap-1"><span className="label">Foto %</span><input name="mix_imagem" type="number" min={0} max={100} defaultValue={plan.mix.imagem} className="ct-input" /></label>
              <label className="flex flex-col gap-1"><span className="label">Hashtags máx.</span><input name="hashtagsMax" type="number" min={0} max={30} defaultValue={plan.hashtagsMax} className="ct-input" /></label>
              <label className="flex flex-col gap-1 sm:col-span-4"><span className="label">Pilares (um por linha: Nome: %)</span>
                <textarea name="pillars" rows={5} defaultValue={plan.pillars.map((p) => `${p.name}: ${p.target}`).join("\n")} className="ct-input" /></label>
              <button className="ct-btn ct-btn-dark">Salvar metas</button>
            </ActionForm>
          </div>
        )}
      </details>
    </section>
  );
}
