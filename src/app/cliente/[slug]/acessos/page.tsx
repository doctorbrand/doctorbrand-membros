import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { CampoSenha, Copiar, SenhaOculta } from "@/components/Acessos";
import { ActionButton } from "@/components/content/ContentActions";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { cofrePronto, getCofre, linhas, situacao, SITUACAO, usaChavePropria, type Credencial, type Situacao } from "@/lib/cofre";
import { getOnboarding } from "@/lib/onboarding";
import { apagarSenhaAction, removerAcessoAction, salvarAcessoAction } from "./actions";

export const dynamic = "force-dynamic";

const quando = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(", ", " às ");

const ORDEM: Situacao[] = ["login-senha", "convite", "so-login", "falta"];

function rotulo(c?: Credencial): string {
  const s = situacao(c);
  if (s === "so-login") return c?.login ? "Falta a senha" : "Falta o login";
  return SITUACAO[s];
}

/** Acessos do cliente: o que temos de login e senha em cada plataforma. Só a equipe. */
export default async function AcessosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireAdmin();
  const c = await getClient(slug);
  if (!c) notFound();
  const [d, onb] = await Promise.all([getCofre(slug), getOnboarding(slug).catch(() => ({ acessos: {} as Record<string, { status: string; nota?: string }> }))]);
  const rows = linhas(d);
  const conta = Object.fromEntries(ORDEM.map((s) => [s, rows.filter((r) => situacao(r.cred) === s).length])) as Record<Situacao, number>;
  const pronto = cofrePronto();
  const log = [...d.log].reverse().slice(0, 12);

  return (
    <Shell active="cofre" session={session} clientSlug={slug}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Acessos · só a equipe</p>
          <h1 className="mt-1.5">{c.name}. <i>Logins e senhas.</i></h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">O que temos de acesso em cada plataforma. As senhas ficam guardadas cifradas e fechadas: só abrem no olho, e cada abertura fica registrada. O cliente não vê esta página.</p>
        </div>
      </section>

      {!pronto && <section className="card p-4 mb-4 text-[14px] g-bad">O cofre de senhas não está configurado neste ambiente. Dá para anotar login e nota, mas senhas não podem ser salvas.</section>}

      <section className="cofre-sum mb-4" aria-label="Resumo">
        {ORDEM.map((s) => (
          <div key={s} className={`cofre-tile is-${s}`}>
            <span className="cofre-n">{conta[s]}</span>
            <span className="cofre-t"><span className={`cofre-dot is-${s}`} aria-hidden />{SITUACAO[s]}</span>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const cr = r.cred;
            const s = situacao(cr);
            const o = onb.acessos[r.id];
            return (
              <li key={r.id} className={`cofre-row is-${s}`}>
                <div className="cofre-head">
                  <span className={`cofre-dot is-${s}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.nome}</span>
                    {!cr && <span className="block text-[12.5px] text-[var(--muted)]">{r.dica ?? "Acesso adicionado pela equipe."}{o ? ` Onboarding: ${o.status === "confirmado" ? "confirmado" : "marcado pelo cliente"}${o.nota ? ` (${o.nota})` : ""}.` : ""}</span>}
                  </span>
                  <span className={`cofre-tag is-${s}`}>{rotulo(cr)}</span>
                </div>

                {cr && (
                  <dl className="cofre-dl">
                    {cr.login && <><dt>Login</dt><dd><span className="cofre-val"><span className="cofre-login">{cr.login}</span><Copiar texto={cr.login} label="Copiar login" /></span></dd></>}
                    {cr.senha && <><dt>Senha</dt><dd><SenhaOculta slug={slug} id={r.id} /></dd></>}
                    {cr.link && <><dt>Link</dt><dd><a href={cr.link} target="_blank" rel="noreferrer noopener" className="cofre-link">{cr.link.replace(/^https?:\/\//, "")}</a></dd></>}
                    {cr.convite && <><dt>Convite</dt><dd>Acesso por convite ou parceiro, sem senha.</dd></>}
                    {cr.nota && <><dt>Nota</dt><dd className="whitespace-pre-line">{cr.nota}</dd></>}
                    {o && <><dt>Onboarding</dt><dd>{o.status === "confirmado" ? "Confirmado" : "Marcado pelo cliente"}{o.nota ? `: ${o.nota}` : ""}</dd></>}
                  </dl>
                )}
                {cr && <p className="cofre-meta">Atualizado por {cr.por} em {quando(cr.atualizadoEm)}</p>}

                <details className="cofre-edit">
                  <summary className="ct-btn ct-btn-ghost">{cr ? "Editar" : "Preencher"}</summary>
                  <ActionForm action={salvarAcessoAction.bind(null, slug, r.id)} className="cofre-form">
                    <label><span>Login</span><input name="login" defaultValue={cr?.login} autoComplete="off" spellCheck={false} placeholder="E-mail, usuário ou telefone" className="ct-input" /></label>
                    <label><span>Senha</span><CampoSenha temSenha={!!cr?.senha} /></label>
                    <label><span>Link</span><input name="link" defaultValue={cr?.link} placeholder="https://" className="ct-input" /></label>
                    <label className="cofre-wide"><span>Nota</span><textarea name="nota" rows={2} defaultValue={cr?.nota} placeholder="Quem tem o acesso, código de dois fatores com quem, observações" className="ct-input" /></label>
                    <label className="cofre-check cofre-wide"><input type="checkbox" name="convite" defaultChecked={cr?.convite} /> <span>Acesso por convite ou parceiro (não precisa de senha)</span></label>
                    <div className="cofre-wide flex flex-wrap gap-2"><button className="ct-btn ct-btn-dark">Salvar</button></div>
                  </ActionForm>
                  {(cr?.senha || r.extra) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {cr?.senha && <ActionButton action={apagarSenhaAction.bind(null, slug, r.id)} label="Apagar senha" variant="ghost" confirm="Apagar a senha salva deste acesso?" />}
                      {r.extra && <ActionButton action={removerAcessoAction.bind(null, slug, r.id)} label="Remover acesso" variant="ghost" confirm="Remover este acesso da lista?" />}
                    </div>
                  )}
                </details>
              </li>
            );
          })}
        </ul>

        <details className="cofre-edit mt-4">
          <summary className="ct-btn">Adicionar outro acesso</summary>
          <ActionForm action={salvarAcessoAction.bind(null, slug, "novo")} className="cofre-form">
            <label className="cofre-wide"><span>Nome</span><input name="nome" required maxLength={60} placeholder="TikTok, Doctoralia, YouTube" className="ct-input" /></label>
            <label><span>Login</span><input name="login" autoComplete="off" spellCheck={false} className="ct-input" /></label>
            <label><span>Senha</span><CampoSenha temSenha={false} /></label>
            <label><span>Link</span><input name="link" placeholder="https://" className="ct-input" /></label>
            <label className="cofre-wide"><span>Nota</span><textarea name="nota" rows={2} className="ct-input" /></label>
            <label className="cofre-check cofre-wide"><input type="checkbox" name="convite" /> <span>Acesso por convite ou parceiro (não precisa de senha)</span></label>
            <div className="cofre-wide"><button className="ct-btn ct-btn-dark">Adicionar</button></div>
          </ActionForm>
        </details>
      </section>

      <section className="card p-5 mt-4">
        <h2 className="pj-h2">Registro</h2>
        <p className="text-[13px] text-[var(--muted)] mt-1">Quem salvou, abriu ou apagou senhas neste cliente.</p>
        {log.length ? (
          <ul className="cofre-log mt-3">
            {log.map((l, i) => <li key={`${l.at}-${i}`}><span className="text-[var(--muted)]">{quando(l.at)}</span> {l.por} {l.acao === "viu" ? "abriu a senha de" : l.acao === "salvou" ? "salvou" : "apagou"} {l.item}</li>)}
          </ul>
        ) : <p className="text-[14px] mt-3 text-[var(--muted)]">Nada ainda.</p>}
        {pronto && !usaChavePropria() && <p className="text-[12px] text-[var(--muted)] mt-4">As senhas usam uma chave tirada da senha-mãe do painel. Se a senha-mãe mudar, as senhas precisam ser salvas de novo, a não ser que a chave própria (ACESSOS_CHAVE) seja criada antes.</p>}
        <p className="text-[12.5px] mt-3"><Link href={`/cliente/${slug}/onboarding`} className="cofre-link">Abrir onboarding e briefing</Link></p>
      </section>
    </Shell>
  );
}
