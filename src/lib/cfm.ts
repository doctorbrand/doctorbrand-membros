import { normalize } from "./tags";

/** Triagem de legendas contra a Resolução CFM 2.336/2023. Sinaliza, não julga. */
const PROIBIDO: Array<[string, RegExp]> = [
  ["CFM-01 promessa/garantia de resultado", /\bGARANT(IA|IDO|IMOS|E)\b|RESULTADO (GARANTIDO|DEFINITIVO|CERTO)|100% (SEGURO|EFICAZ)|SEM RISCO/],
  ["CFM-02 superlativo", /\bO MELHOR\b|\bA MELHOR\b|\bMAIS QUALIFICAD|REFERENCIA (EM|NACIONAL|NO)|\bNUMERO 1\b|\bN[º°]? ?1\b|\bO MAIOR\b|\bUNICO (MEDICO|CIRURGIAO)/],
  ["CFM-03 antes e depois", /ANTES E DEPOIS|ANTES\/DEPOIS|\bANTES X DEPOIS\b/],
  ["CFM-06 serviço gratuito como isca", /\bGRATIS\b|\bGRATUIT[AO]\b|\bDE GRACA\b|CONSULTA FREE/],
  ["CFM-07 preço no anúncio", /R\$ ?\d|\bPARCEL(A|E|AMENTO)\b|\bDESCONTO\b|\bPROMOC(AO|IONAL)\b|\bA PARTIR DE\b/],
];
const CINZA: Array<[string, RegExp]> = [
  ["CFM-08/10 'transformação' / 'rejuvenescimento'", /\bTRANSFORMA(CAO|R|)\b|REJUVENESC/],
  ["CFM-09 tempo de recuperação como promessa", /RECUPERA(CAO)? (EM|DE) \d+ ?(DIAS?|HORAS?|H)\b|\bVOLTA(R)? (AO TRABALHO|A ROTINA) EM \d+/],
];

/** Termos proibidos (alta) e de atenção (cinza) numa legenda. */
export function scanCfmText(text: string): { rule: string; severity: "alta" | "cinza"; match: string }[] {
  const n = normalize(text);
  const out: { rule: string; severity: "alta" | "cinza"; match: string }[] = [];
  for (const [rule, re] of PROIBIDO) { const m = n.match(re); if (m) out.push({ rule, severity: "alta", match: m[0] }); }
  for (const [rule, re] of CINZA) { const m = n.match(re); if (m) out.push({ rule, severity: "cinza", match: m[0] }); }
  return out;
}
