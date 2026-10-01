import type { Contrato } from "./project";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(y, m - 1 + n, Math.min(d, last)));
  return dt.toISOString().slice(0, 10);
}

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400e3);

export const dataCurta = (iso: string) => `${Number(iso.slice(8, 10))} ${MES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** "1 ano e 2 meses", "5 meses", "12 dias". */
export function tempoDesde(inicio: string, hoje: string): string {
  const [y1, m1, d1] = inicio.split("-").map(Number), [y2, m2, d2] = hoje.split("-").map(Number);
  let meses = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (meses < 1) { const d = Math.max(0, days(inicio, hoje)); return `${d} ${d === 1 ? "dia" : "dias"}`; }
  const anos = Math.floor(meses / 12); meses %= 12;
  const a = anos ? `${anos} ${anos === 1 ? "ano" : "anos"}` : "";
  const m = meses ? `${meses} ${meses === 1 ? "mês" : "meses"}` : "";
  return [a, m].filter(Boolean).join(" e ");
}

export interface ContratoStatus {
  inicio?: string;
  /** Desde quando é cliente (contrato ou primeiro registro). */
  desde?: string;
  /** Fim do ciclo atual / próxima renovação. */
  proxima?: string;
  cicloInicio?: string;
  diasParaProxima?: number;
  /** Progresso do ciclo atual (0 a 1). */
  progresso?: number;
  vencido: boolean;
  regraTexto?: string;
  url?: string;
}

/**
 * Ciclo do contrato. "iguais" renova por períodos iguais ao prazo inicial; "mensal" vira mês a mês
 * depois do prazo; "nova" termina no prazo e precisa de um contrato novo.
 */
export function contratoStatus(c: Contrato | undefined, hoje: string, clienteDesde?: string, renovacaoCrm?: string): ContratoStatus {
  const inicio = c?.inicio;
  const desde = inicio && clienteDesde ? (clienteDesde < inicio ? clienteDesde : inicio) : inicio ?? clienteDesde;
  const meses = c?.meses && c.meses > 0 ? c.meses : undefined;
  const regra = c?.regra ?? "iguais";
  let cicloInicio: string | undefined, proxima: string | undefined, vencido = false;

  if (inicio && meses) {
    const fimInicial = addMonths(inicio, meses);
    if (regra === "nova") { cicloInicio = inicio; proxima = fimInicial; vencido = fimInicial < hoje; }
    else {
      const passo = regra === "mensal" && fimInicial <= hoje ? 1 : meses;
      let a = regra === "mensal" && fimInicial <= hoje ? fimInicial : inicio;
      let b = addMonths(a, passo);
      for (let i = 0; b <= hoje && i < 240; i++) { a = b; b = addMonths(a, passo); }
      cicloInicio = a; proxima = b;
    }
  }
  // Data informada à mão (ou no CRM do ClickUp). Se já passou e o contrato renova sozinho,
  // vale o ciclo calculado; sem ciclo calculado, a data anda para a frente pelo prazo.
  const manual = c?.renovacao || renovacaoCrm;
  if (manual) {
    if (manual >= hoje || regra === "nova") { proxima = manual; vencido = manual < hoje && regra === "nova"; }
    else if (!proxima) {
      const passo = regra === "mensal" ? 1 : meses ?? 12;
      let b = manual;
      for (let i = 0; b < hoje && i < 240; i++) b = addMonths(b, passo);
      proxima = b;
    }
  }

  const regraTexto = !meses ? undefined
    : regra === "iguais" ? `Renova automaticamente a cada ${meses} ${meses === 1 ? "mês" : "meses"}.`
    : regra === "mensal" ? `Prazo inicial de ${meses} meses; depois, renovação mensal.`
    : `Prazo de ${meses} meses. Para continuar, um novo contrato.`;
  const progresso = cicloInicio && proxima ? Math.min(1, Math.max(0, days(cicloInicio, hoje) / Math.max(1, days(cicloInicio, proxima)))) : undefined;
  return { inicio, desde, proxima, cicloInicio, diasParaProxima: proxima ? days(hoje, proxima) : undefined, progresso, vencido, regraTexto, url: c?.url };
}
