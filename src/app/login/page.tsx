import { adminHome, clientHome } from "@/lib/home";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PasswordField } from "@/components/PasswordField";
import { LogoFull, LogoMark } from "@/components/Logo";
import { ArtRotator } from "@/components/ArtRotator";
import { startingArt } from "@/lib/art";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const s = await getSession();
  if (s) redirect(s.role === "cliente" && s.clientSlug ? clientHome(s.clientSlug) : adminHome());
  const { erro } = await searchParams;
  const start = startingArt();
  return (
    <main className="db-login">
      <div className="db-login-frame">
        {/* Painel com as obras */}
        <section className="db-login-visual">
          <ArtRotator start={start} quote="Seu conteúdo, aprovado antes de ir ao ar."
            chip={<span className="db-login-chip"><LogoMark className="w-3.5 h-3.5" /> Área de membros</span>}
            logo={<LogoFull className="db-art-logo" />} />
        </section>

        {/* Formulário */}
        <section className="db-login-form">
          <LogoFull className="db-form-logo h-[30px] text-[var(--ink)]" />
          <div className="db-form-body">
            <h1 className="db-form-title">Bem-vindo,<br />entre na sua conta.</h1>
            <p className="db-form-sub">Acesse o planejamento do seu conteúdo.</p>
            <form action="/api/login" method="post" className="db-form">
              <label className="db-field"><span>E-mail</span>
                <input name="email" type="email" inputMode="email" autoComplete="username" autoFocus placeholder="voce@clinica.com.br" className="db-input" /></label>
              <label className="db-field"><span>Senha</span>
                <PasswordField className="db-input" /></label>
              {erro === "1" && <p role="alert" className="text-sm g-bad">E-mail ou senha incorretos.</p>}
              {erro === "sem-cliente" && <p role="alert" className="text-sm g-bad">Este acesso ainda não está ligado a um perfil. Fale com a equipe DoctorBrand.</p>}
              <div className="db-form-actions">
                <button className="db-btn">Entrar</button>
                <span className="db-forgot">Esqueceu a senha? Fale com a equipe.</span>
              </div>
            </form>
          </div>
          <p className="db-form-foot">Nada é publicado sem a sua aprovação.</p>
        </section>
      </div>
    </main>
  );
}
