import { adminHome, clientHome } from "@/lib/home";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PasswordField } from "@/components/PasswordField";
import { CalendarIcon, CheckIcon, EyeIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const POINTS = [
  { icon: <EyeIcon size={18} />, text: "Veja o seu feed exatamente como ele vai ficar." },
  { icon: <CheckIcon size={18} />, text: "Aprove ou peça ajuste em cada post, com um toque." },
  { icon: <CalendarIcon size={18} />, text: "Acompanhe o que já está agendado para ir ao ar." },
];

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const s = await getSession();
  if (s) redirect(s.role === "cliente" && s.clientSlug ? clientHome(s.clientSlug) : adminHome());
  const { erro } = await searchParams;
  return (
    <main className="db-login">
      <div className="db-login-inner">
        <section className="db-login-brand">
          <p className="db-wordmark text-2xl">Doctor<i>Brand</i></p>
          <h1 className="db-serif-title mt-8 sm:mt-14">
            Seu conteúdo,
            <i>antes de ir ao ar.</i>
          </h1>
          <ul className="hidden sm:flex flex-col gap-3 mt-8">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-[15px] text-[var(--brand-cream)]/85">
                <span className="db-login-icon">{p.icon}</span>{p.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="db-login-card">
          <div>
            <p className="db-kicker">Área de membros</p>
            <h2 className="text-xl font-semibold mt-1 text-[var(--brand-cream)]">Entrar</h2>
          </div>
          <form action="/api/login" method="post" className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5"><span className="db-kicker">E-mail</span>
              <input name="email" type="email" inputMode="email" autoComplete="username" autoFocus placeholder="voce@clinica.com.br" className="db-input" /></label>
            <label className="flex flex-col gap-1.5"><span className="db-kicker">Senha</span>
              <PasswordField className="db-input" /></label>
            {erro === "1" && <p role="alert" className="text-sm text-[#f0a39c]">E-mail ou senha incorretos. Confira e tente de novo.</p>}
            {erro === "sem-cliente" && <p role="alert" className="text-sm text-[#f0a39c]">Este acesso ainda não está ligado a um perfil. Fale com a equipe DoctorBrand.</p>}
            <button className="db-btn-gold mt-1">Entrar</button>
          </form>
          <p className="text-xs text-[var(--brand-mute)] leading-relaxed">Esqueceu a senha? Fale com a equipe DoctorBrand pelo WhatsApp e enviamos um novo acesso.</p>
        </section>
      </div>
    </main>
  );
}
