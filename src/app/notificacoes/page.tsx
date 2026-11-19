import { ActionForm } from "@/components/ActionForm";
import { ActionButton } from "@/components/content/ContentActions";
import { PushSetup } from "@/components/PushSetup";
import { Shell } from "@/components/Shell";
import { requireAuth } from "@/lib/auth";
import { getPushDoc, pushLigado, quer, TIPOS, vapidPublica, type TipoPush } from "@/lib/push";
import { prefsAction, testeAction } from "./actions";

export const dynamic = "force-dynamic";

/** Notificações no celular: ativar neste aparelho e escolher o que receber. Cliente e equipe. */
export default async function NotificacoesPage() {
  const session = await requireAuth();
  const ligado = pushLigado();
  const podeAtivar = !!session.userId && !session.preview;
  const doc = session.userId ? await getPushDoc(session.userId) : { subs: [], prefs: {} };
  const meus = (Object.keys(TIPOS) as TipoPush[]).filter((t) => TIPOS[t].para === (session.role === "admin" ? "admin" : "cliente"));

  return (
    <Shell active="notificacoes" session={session}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Notificações</p>
          <h1 className="mt-1.5">Avisos no seu celular</h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2">{session.role === "admin" ? "Saiba na hora quando um cliente aprova, pede alteração ou agenda." : "Saiba quando há posts para aprovar, quando eles vão ao ar e como foram."} Nada chega entre 21h e 8h.</p>
        </div>
      </section>

      {!ligado ? (
        <section className="card p-5 text-[14px] text-[var(--muted)]">As notificações ainda não foram ligadas na área. A equipe DoctorBrand avisa quando estiverem disponíveis.</section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 items-start">
          <section className="card p-5 flex flex-col gap-3">
            <h2 className="font-semibold text-[16px]">Este aparelho</h2>
            <PushSetup chavePublica={vapidPublica()} podeAtivar={podeAtivar} />
            {doc.subs.length > 0 && (
              <div className="pt-3 mt-1 border-t border-[var(--line)] flex flex-col gap-2">
                <p className="text-[13px] text-[var(--muted)]">Ativadas em {doc.subs.length} {doc.subs.length === 1 ? "aparelho" : "aparelhos"}: {doc.subs.map((s) => s.aparelho ?? "aparelho").join(", ")}.</p>
                <div><ActionButton action={testeAction} label="Enviar um teste" variant="ghost" /></div>
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-[16px] mb-3">O que você quer receber</h2>
            {podeAtivar ? (
              <ActionForm action={prefsAction} className="flex flex-col gap-1">
                {meus.map((t) => (
                  <label key={t} className="nt-pref">
                    <input type="checkbox" name={t} defaultChecked={quer(doc, t)} className="nt-check" />
                    <span className="min-w-0">
                      <span className="block font-medium text-[15px]">{TIPOS[t].label}</span>
                      <span className="block text-[13px] text-[var(--muted)]">{TIPOS[t].dica}</span>
                    </span>
                  </label>
                ))}
                <div className="mt-3"><button className="ct-btn ct-btn-dark">Salvar</button></div>
              </ActionForm>
            ) : (
              <p className="text-[14px] text-[var(--muted)]">Entre com o seu usuário para escolher.</p>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
