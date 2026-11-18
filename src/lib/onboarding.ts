import { randomBytes, timingSafeEqual } from "crypto";
import type { ClientProfile } from "./profile";
import { readDoc, writeDoc } from "./store";

/**
 * Onboarding do cliente: acessos (sem senhas, só convites e permissões) e briefing.
 * O cliente marca o que fez; a equipe confirma. As respostas do briefing alimentam o Perfil.
 */
export interface Acesso { id: string; titulo: string; texto: string; passos: string[]; anuncios?: boolean }

const EMAIL = "contato@doctorbrand.co";
const partner = () => process.env.META_PARTNER_ID;

export function acessos(): Acesso[] {
  return [
    { id: "instagram", titulo: "Instagram profissional", texto: "Conta comercial ou de criador, ligada a uma Página do Facebook.", passos: ["No Instagram, Configurações, Tipo de conta: mude para conta profissional.", "Na Central de Contas, ligue o Instagram à Página do Facebook da clínica."] },
    { id: "meta", titulo: "Acesso de parceiro no Meta Business", texto: "Libera Página, Instagram e anúncios para a equipe sem compartilhar senha.", passos: ["Abra business.facebook.com, Configurações, Parceiros.", `Toque em Adicionar e informe o ID de parceiro da DoctorBrand${partner() ? `: ${partner()}` : " (a equipe envia pelo WhatsApp)"}.`, "Marque a Página, o Instagram e a conta de anúncios."] },
    { id: "pagamento", titulo: "Pagamento na conta de anúncios", texto: "O cartão fica em seu nome. A DoctorBrand não precisa dele.", passos: ["No Gerenciador de Anúncios, Cobrança, adicione a forma de pagamento.", "A verba mensal é combinada com a equipe."], anuncios: true },
    { id: "google-ads", titulo: "Google Ads", texto: "Para os anúncios na pesquisa do Google.", passos: ["Aceite o convite da conta de administrador da DoctorBrand que chega no seu e-mail.", "Sem conta ainda? A equipe cria com você na reunião."], anuncios: true },
    { id: "google-perfil", titulo: "Perfil da empresa no Google", texto: "O cartão da clínica no Google e no Maps.", passos: ["No Google, pesquise o nome da clínica e abra o perfil.", `Menu, Perfil da empresa, Gerentes: adicione ${EMAIL} como administrador.`] },
    { id: "site", titulo: "Site e domínio", texto: "Para ajustes no site e na página de links.", passos: [`No painel da hospedagem ou do domínio, convide ${EMAIL} como usuário.`, "Não envie senhas por aqui nem por mensagem."] },
    { id: "midia", titulo: "Fotos e vídeos que você já tem", texto: "Material antigo ajuda a equipe a conhecer sua marca.", passos: [`Compartilhe a pasta no Google Drive com ${EMAIL}.`, "Ou envie pelo WhatsApp da equipe."] },
    { id: "agendamento", titulo: "Canal de agendamento", texto: "Onde o paciente marca a consulta: WhatsApp, secretária ou sistema.", passos: ["Escreva na nota abaixo o número ou link que deve aparecer na bio e nos anúncios."] },
  ];
}

export type AcessoStatus = "feito" | "confirmado";
export interface AcessoMarca { status: AcessoStatus; nota?: string; at: string; por: string }

export interface BriefingPergunta { key: keyof ClientProfile; pergunta: string; dica?: string; rows: number }

export const BRIEFING: BriefingPergunta[] = [
  { key: "objetivo", pergunta: "O que você quer que o seu digital gere nos próximos 6 meses?", dica: "Mais consultas de um procedimento, autoridade, lançamento de clínica.", rows: 3 },
  { key: "publico", pergunta: "Quem é o seu paciente ideal?", dica: "Idade, momento de vida, onde mora, o que procura.", rows: 3 },
  { key: "servicos", pergunta: "Quais procedimentos você quer atrair mais?", dica: "Um por linha, na ordem de prioridade.", rows: 3 },
  { key: "diferenciais", pergunta: "O que você faz diferente dos colegas da sua área?", dica: "Técnica, estrutura, forma de atender, resultados.", rows: 3 },
  { key: "historia", pergunta: "Conte a sua trajetória.", dica: "Formação, a virada, o que te move na medicina.", rows: 4 },
  { key: "dorObjecao", pergunta: "Quais dúvidas e medos os pacientes mais trazem na consulta?", rows: 3 },
  { key: "expressoesUsar", pergunta: "Palavras e expressões que você sempre usa com os pacientes.", rows: 2 },
  { key: "expressoesEvitar", pergunta: "O que você nunca diria ou não gosta de ver em perfis médicos?", rows: 2 },
  { key: "concorrentes", pergunta: "Perfis que você admira ou considera concorrentes.", dica: "@ do Instagram.", rows: 2 },
  { key: "crmRqe", pergunta: "CRM e RQE, como devem aparecer na bio.", rows: 1 },
];

export interface OnboardingDoc {
  acessos: Record<string, AcessoMarca>;
  briefing?: { respostas: Partial<Record<keyof ClientProfile, string>>; enviadoEm?: string; por?: string; aplicadoEm?: string; viaLink?: boolean };
  /** Link do briefing sem login (a equipe manda pelo WhatsApp). Trocar o link desliga o anterior. */
  briefingLink?: { token: string; criadoEm: string; por: string };
}

const path = (slug: string) => `onboarding/${slug}`;
export const getOnboarding = (slug: string) => readDoc<OnboardingDoc>(path(slug), { acessos: {} });
export const saveOnboarding = (slug: string, d: OnboardingDoc) => writeDoc(path(slug), d);

/** Token novo e difícil de adivinhar para o link do briefing. */
export function novoTokenBriefing(): string {
  return randomBytes(18).toString("base64url");
}

/** Confere o token do link do briefing sem vazar tempo de comparação. */
export function tokenBriefingOk(d: OnboardingDoc, token: string): boolean {
  const certo = d.briefingLink?.token;
  if (!certo || !/^[\w-]{20,40}$/.test(token)) return false;
  const a = Buffer.from(token), b = Buffer.from(certo);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const briefingPath = (slug: string, token: string) => `/briefing/${slug}/${token}`;

/** Respostas do formulário, só das perguntas do briefing, com limite de tamanho. */
export function respostasDoForm(fd: FormData): Partial<Record<keyof ClientProfile, string>> {
  return Object.fromEntries(BRIEFING.map((q) => [q.key, String(fd.get(q.key) ?? "").trim().slice(0, 3000)]).filter(([, v]) => v));
}

/** Itens que valem para o plano (anúncios só em Growth e Black). */
export function acessosDoPlano(comAnuncios: boolean): Acesso[] {
  return acessos().filter((a) => !a.anuncios || comAnuncios);
}

export function progresso(d: OnboardingDoc, itens: Acesso[]) {
  const feitos = itens.filter((a) => d.acessos[a.id]).length;
  const confirmados = itens.filter((a) => d.acessos[a.id]?.status === "confirmado").length;
  const briefing = !!d.briefing?.enviadoEm;
  const total = itens.length + 1;
  return { feitos, confirmados, total: itens.length, briefing, pct: Math.round(((feitos + (briefing ? 1 : 0)) / total) * 100), completo: feitos === itens.length && briefing };
}
