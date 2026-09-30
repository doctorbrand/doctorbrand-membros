import { ArrowUpRightIcon, CheckIcon, RocketIcon } from "@/components/Icons";
import { nextPlan, PLANS } from "@/lib/plans";
import { TEAM_WHATSAPP } from "@/lib/project";

/** Próximo passo da esteira para o plano do cliente. Sem preço: abre conversa com a equipe. */
export function NextStep({ plano, whatsapp, clientName, compact = false }: { plano?: string; whatsapp?: string; clientName: string; compact?: boolean }) {
  const k = nextPlan(plano);
  if (!k) return null;
  const p = PLANS[k];
  const msg = `Olá! Aqui é ${clientName}. Vi na área de membros o plano ${p.name} e quero entender como ele ficaria no meu projeto.`;
  const phone = (whatsapp || TEAM_WHATSAPP).replace(/\D/g, "");
  const href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `mailto:contato@doctorbrand.co?subject=${encodeURIComponent(`Plano ${p.name}`)}&body=${encodeURIComponent(msg)}`;
  return (
    <section className="card p-5 ev-next">
      <div className="flex items-center gap-3">
        <span className="pj-mat-ic"><RocketIcon /></span>
        <span className="min-w-0"><span className="label block">O próximo passo do seu projeto</span><span className="block font-semibold text-[17px] tracking-tight">Plano {p.name}. <span className="text-[var(--muted)] font-medium">{p.tagline}</span></span></span>
      </div>
      {!compact && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {p.includes.map((x) => <li key={x} className="flex gap-2 text-[14px]"><span className="ev-check"><CheckIcon size={11} /></span>{x}</li>)}
        </ul>
      )}
      <p className="text-[12.5px] text-[var(--muted)] mt-3">Tudo o que você já tem continua. O {p.name} soma ao seu plano atual.</p>
      <a href={href} target="_blank" rel="noreferrer" className="ct-btn ct-btn-dark mt-3 inline-flex items-center gap-1.5 self-start">Quero conversar sobre o {p.name} <ArrowUpRightIcon size={14} /></a>
    </section>
  );
}
