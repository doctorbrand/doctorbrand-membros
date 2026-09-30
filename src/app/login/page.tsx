import { adminHome, clientHome } from "@/lib/home";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PasswordField } from "@/components/PasswordField";
import { LogoFull, LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const s = await getSession();
  if (s) redirect(s.role === "cliente" && s.clientSlug ? clientHome(s.clientSlug) : adminHome());
  const { erro } = await searchParams;
  return (
    <main className="db-login">
      <div className="db-login-frame">
        {/* Painel visual */}
        <section className="db-login-visual" aria-hidden>
          <span className="db-login-chip"><LogoMark className="w-3.5 h-3.5" /> Área de membros</span>
          <LogoMark className="db-login-emblem" />
          <div className="relative">
            <p className="text-[30px] leading-[1.1] font-medium tracking-[-0.02em] text-white max-w-[340px]">Seu conteúdo, aprovado antes de ir ao ar.</p>
            <div className="flex items-center justify-between mt-8 text-[12px] text-white/55">
              <LogoFull className="h-4 text-white/85" />
              <span>© DoctorBrand {new Date().getFullYear()}</span>
            </div>
          </div>
        </section>

        {/* Formulário */}
        <section className="db-login-form">
          <LogoFull className="h-[20px] sm:h-[22px] text-[var(--ink)]" />
          <div className="my-auto py-10 w-full">
            <h1 className="text-[30px] sm:text-[34px] leading-[1.1] font-semibold tracking-[-0.03em]">Bem-vindo,<br />entre na sua conta.</h1>
            <form action="/api/login" method="post" className="flex flex-col gap-4 mt-8">
              <label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">E-mail</span>
                <input name="email" type="email" inputMode="email" autoComplete="username" autoFocus placeholder="voce@clinica.com.br" className="db-input" /></label>
              <label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">Senha</span>
                <PasswordField className="db-input" /></label>
              {erro === "1" && <p role="alert" className="text-sm g-bad">E-mail ou senha incorretos.</p>}
              {erro === "sem-cliente" && <p role="alert" className="text-sm g-bad">Este acesso ainda não está ligado a um perfil. Fale com a equipe DoctorBrand.</p>}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-4 mt-2">
                <button className="db-btn">Entrar</button>
                <span className="text-[13px] text-[var(--muted)] text-right">Esqueceu a senha? Fale com a equipe.</span>
              </div>
            </form>
          </div>
          <p className="text-[12px] text-[var(--muted)]">Nada é publicado sem a sua aprovação.</p>
        </section>
      </div>
    </main>
  );
}
