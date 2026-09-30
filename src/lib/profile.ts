import { PROFILE_SEED } from "./profileSeed";
import { readDoc, writeDoc } from "./store";

/**
 * Perfil estratégico do cliente: o padrão DoctorBrand para briefing, história, tom de voz,
 * expressões e playbook. É a base para ler o feed e para gerar roteiros e stories.
 */
export interface ClientProfile {
  /** @ do Instagram, sem arroba (usado quando a conta ainda não está ligada pela Meta). */
  instagram?: string;
  objetivo?: string;
  publico?: string;
  posicionamento?: string;
  historia?: string;
  tomDeVoz?: string;
  expressoesUsar?: string;
  expressoesEvitar?: string;
  pilares?: string;
  servicos?: string;
  diferenciais?: string;
  playbook?: string;
  restricoes?: string;
  referencias?: string;
  crmRqe?: string;
  arquetipo?: string;
  dorObjecao?: string;
  cta?: string;
  vozDm?: string;
  concorrentes?: string;
  /** Conflitos entre fontes e dados sem fonte, para confirmar com o cliente. */
  pendencias?: string;
  /** Nota visual do feed (0 a 10) dada pela equipe, com observação. */
  visualScore?: number;
  visualNota?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const PROFILE_FIELDS: { key: keyof ClientProfile; label: string; hint: string; rows: number; group: "base" | "voz" | "operacao" }[] = [
  { key: "objetivo", label: "Objetivo", hint: "O que o perfil precisa gerar nos próximos meses (agenda, autoridade, lançamento).", rows: 2, group: "base" },
  { key: "publico", label: "Público", hint: "Quem é a paciente ou o cliente ideal: idade, momento de vida, região, objeções.", rows: 3, group: "base" },
  { key: "posicionamento", label: "Posicionamento", hint: "A frase que resume por que este profissional é a referência.", rows: 2, group: "base" },
  { key: "historia", label: "História", hint: "Formação, trajetória, virada, o que o move. Base para conteúdos de conexão.", rows: 5, group: "base" },
  { key: "servicos", label: "Procedimentos e serviços", hint: "Um por linha, na ordem de prioridade comercial.", rows: 4, group: "base" },
  { key: "diferenciais", label: "Diferenciais", hint: "Técnicas, estrutura, método, resultados que podem ser citados.", rows: 3, group: "base" },
  { key: "dorObjecao", label: "Dor e objeção principal", hint: "O que tira o sono do paciente e o que o impede de agendar.", rows: 3, group: "base" },
  { key: "crmRqe", label: "CRM e RQE", hint: "Obrigatório no rodapé e na bio (CFM).", rows: 1, group: "base" },
  { key: "arquetipo", label: "Arquétipo", hint: "Principal e secundário (ex.: Sábio e Cuidador).", rows: 1, group: "voz" },
  { key: "tomDeVoz", label: "Tom de voz", hint: "Como fala: formal ou próximo, frases curtas, termos técnicos, humor.", rows: 3, group: "voz" },
  { key: "expressoesUsar", label: "Expressões para usar", hint: "Palavras e bordões do cliente. Uma por linha.", rows: 4, group: "voz" },
  { key: "expressoesEvitar", label: "Expressões para evitar", hint: "O que nunca dizer: clichês, promessas, termos que o cliente não gosta.", rows: 4, group: "voz" },
  { key: "vozDm", label: "Voz no Direct", hint: "Como a equipe ou a secretária responde mensagens.", rows: 2, group: "voz" },
  { key: "cta", label: "CTA padrão", hint: "Chamada para ação que o cliente usa (ex.: agende pelo link da bio).", rows: 1, group: "operacao" },
  { key: "pilares", label: "Pilares editoriais", hint: "Os temas fixos do feed e o que cada um entrega.", rows: 4, group: "operacao" },
  { key: "playbook", label: "Playbook", hint: "Formatos que funcionam, cadência, quadros fixos, o que já testamos.", rows: 5, group: "operacao" },
  { key: "restricoes", label: "Restrições e CFM", hint: "Limites do cliente e pontos de atenção da Resolução CFM 2.336/2023.", rows: 3, group: "operacao" },
  { key: "concorrentes", label: "Concorrentes e referências de perfil", hint: "@ de concorrentes diretos e de perfis que inspiram.", rows: 2, group: "operacao" },
  { key: "pendencias", label: "Pontos a confirmar com o cliente", hint: "Conflitos entre fontes e dados que ainda não têm origem. Apague a linha quando confirmar.", rows: 4, group: "operacao" },
  { key: "referencias", label: "Referências e links", hint: "Drive, Notion, perfis de referência. Um por linha.", rows: 3, group: "operacao" },
];

/** Perfis levantados para clientes cadastrados depois pela tela Clientes, cujo endereço pode variar (ex.: dr-brunno). */
const SEED_MATCH: [RegExp, string][] = [[/brunno/, "brunno-bernardo"], [/fernando/, "fernando-fontes"]];

function seedFor(slug: string): ClientProfile | undefined {
  if (PROFILE_SEED[slug]) return PROFILE_SEED[slug];
  const hit = SEED_MATCH.find(([re]) => re.test(slug));
  return hit ? PROFILE_SEED[hit[1]] : undefined;
}

export async function getProfile(slug: string): Promise<ClientProfile> {
  const saved = await readDoc<ClientProfile>(`perfil/${slug}`, {});
  // Campo salvo vazio não apaga o que foi levantado das fontes.
  const filled = Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== "" && v !== null && v !== undefined));
  return { ...(seedFor(slug) ?? {}), ...filled };
}

export async function saveProfile(slug: string, patch: ClientProfile, by: string): Promise<void> {
  const cur = await getProfile(slug);
  await writeDoc(`perfil/${slug}`, { ...cur, ...patch, updatedAt: new Date().toISOString(), updatedBy: by });
}

/** Quanto do perfil está preenchido (0 a 100). */
export function profileCompleteness(p: ClientProfile): number {
  const filled = PROFILE_FIELDS.filter((f) => f.key !== "pendencias").filter((f) => String(p[f.key] ?? "").trim().length > 0).length;
  return Math.round((filled / (PROFILE_FIELDS.length - 1)) * 100);
}
