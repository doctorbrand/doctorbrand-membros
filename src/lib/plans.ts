/** Planos de gestão mensal DoctorBrand (sem preço na área do cliente). */
export type PlanKey = "core" | "growth" | "black";

export const PLANS: Record<PlanKey, { name: string; tagline: string; includes: string[] }> = {
  core: {
    name: "Core",
    tagline: "Conteúdo de autoridade, todo mês.",
    includes: ["Planejamento mensal de conteúdo", "Roteiros autorais e design de feed", "Direção pelo método D.O.M.Í.N.I.O.", "Captação audiovisual periódica", "Reunião estratégica mensal"],
  },
  growth: {
    name: "Growth",
    tagline: "O conteúdo passa a trazer pacientes.",
    includes: ["Anúncios no Meta e no Google, geridos e otimizados", "Funil de captação de contatos", "Relatório de performance", "Painel de métricas em tempo real"],
  },
  black: {
    name: "Black",
    tagline: "Do contato à consulta marcada.",
    includes: ["Diagnóstico do seu processo de vendas", "Script de atendimento para a secretária", "Follow-up automatizado e CRM", "Treinamento comercial e análise de conversão"],
  },
};

export function planKey(plano: string | undefined): PlanKey | null {
  const p = (plano ?? "").toLowerCase();
  if (/black/.test(p)) return "black";
  if (/growth/.test(p)) return "growth";
  if (/core/.test(p)) return "core";
  return null;
}

/** Próximo passo da esteira para o plano atual (Core → Growth → Black). */
export function nextPlan(plano: string | undefined): PlanKey | null {
  const k = planKey(plano);
  return k === "core" ? "growth" : k === "growth" ? "black" : null;
}
