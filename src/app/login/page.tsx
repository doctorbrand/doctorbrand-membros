import { adminHome, clientHome } from "@/lib/home";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const s = await getSession();
  if (s) redirect(s.role === "cliente" && s.clientSlug ? clientHome(s.clientSlug) : adminHome());
  const { erro } = await searchParams;
  const input = "border border-[var(--line)] rounded-lg px-3 py-2 bg-white";
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-6 w-full max-w-sm flex flex-col gap-5">
        <div>
          <div className="font-semibold text-lg">DoctorBrand · Área de membros</div>
          <div className="text-sm text-[var(--muted)]">Planejamento, aprovação e agendamento do seu conteúdo.</div>
        </div>
        <form action="/api/login" method="post" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm"><span className="label">E-mail</span><input name="email" type="email" autoComplete="username" className={input} /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="label">Senha</span><input name="password" type="password" autoComplete="current-password" required autoFocus className={input} /></label>
          {erro === "1" && <div className="text-sm g-bad">E-mail ou senha incorretos.</div>}
          {erro === "sem-cliente" && <div className="text-sm g-bad">Acesso sem cliente vinculado. Fale com a DoctorBrand.</div>}
          <button className="bg-[var(--ink)] text-white rounded-lg px-4 py-2 font-medium">Entrar</button>
          <p className="text-xs text-[var(--muted)]">Equipe DoctorBrand: deixe o e-mail em branco e use a senha mestre.</p>
        </form>
      </div>
    </main>
  );
}
