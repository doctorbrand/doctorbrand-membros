import { adminHome, clientHome } from "@/lib/home";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PasswordField } from "@/components/PasswordField";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const s = await getSession();
  if (s) redirect(s.role === "cliente" && s.clientSlug ? clientHome(s.clientSlug) : adminHome());
  const { erro } = await searchParams;
  return (
    <main className="db-login">
      <div className="w-full max-w-[380px] flex flex-col items-center">
        <div className="db-appicon" aria-hidden>D</div>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] mt-5">DoctorBrand</h1>
        <p className="text-[15px] text-[var(--muted)] mt-1 text-center">Aprove e acompanhe o seu conteúdo.</p>

        <form action="/api/login" method="post" className="db-login-card mt-8">
          <input name="email" type="email" inputMode="email" autoComplete="username" autoFocus placeholder="E-mail" aria-label="E-mail" className="db-input" />
          <PasswordField className="db-input" />
          {erro === "1" && <p role="alert" className="text-sm g-bad px-1">E-mail ou senha incorretos.</p>}
          {erro === "sem-cliente" && <p role="alert" className="text-sm g-bad px-1">Este acesso ainda não está ligado a um perfil. Fale com a equipe DoctorBrand.</p>}
          <button className="db-btn mt-1">Entrar</button>
        </form>
        <p className="text-[13px] text-[var(--muted)] mt-6 text-center">Esqueceu a senha? Fale com a equipe DoctorBrand.</p>
      </div>
    </main>
  );
}
