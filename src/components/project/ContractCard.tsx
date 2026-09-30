import { ArrowUpRightIcon, DocIcon } from "@/components/Icons";
import { dataCurta, tempoDesde, type ContratoStatus } from "@/lib/contrato";

/** Contrato: há quanto tempo é cliente, ciclo atual, próxima renovação e o link do contrato. */
export function ContractCard({ st, plano, hoje, admin }: { st: ContratoStatus; plano?: string; hoje: string; admin: boolean }) {
  if (!st.desde && !st.proxima && !st.url) return null;
  const alerta = st.diasParaProxima !== undefined && st.diasParaProxima <= 30;
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="pj-h2">{admin ? "Contrato" : "Seu contrato"}</h2>
        {plano && <span className="ev-tag">Plano {plano}</span>}
      </div>
      {st.desde && <p className="mt-2"><b className="text-[26px] font-semibold tracking-tight">{tempoDesde(st.desde, hoje)}</b> <span className="text-[14px] text-[var(--muted)]">de parceria, desde {dataCurta(st.desde)}</span></p>}
      {st.proxima && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="text-[var(--muted)]">{st.vencido ? "Prazo encerrado em" : "Próxima renovação"}</span>
            <span className={`font-medium ${admin && alerta ? "g-warn" : ""}`}>{dataCurta(st.proxima)}{st.diasParaProxima !== undefined && st.diasParaProxima >= 0 ? ` · em ${st.diasParaProxima} ${st.diasParaProxima === 1 ? "dia" : "dias"}` : ""}</span>
          </div>
          {st.progresso !== undefined && <div className="pj-bar"><span style={{ width: `${st.progresso * 100}%` }} /></div>}
        </div>
      )}
      {st.regraTexto && <p className="text-[12.5px] text-[var(--muted)] mt-2">{st.regraTexto}</p>}
      {st.url && (
        <a href={st.url} target="_blank" rel="noreferrer" className="pj-mat mt-3">
          <span className="pj-mat-ic"><DocIcon /></span>
          <span className="min-w-0 flex-1"><span className="block font-medium">Ver contrato</span><span className="block text-[12px] text-[var(--muted)]">Abre no Drive</span></span>
          <ArrowUpRightIcon className="text-[var(--muted)]" />
        </a>
      )}
    </section>
  );
}
