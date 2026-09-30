import { METODO } from "./evolucao";
import { PLANS } from "./plans";

/** Central de Ajuda: o mesmo conteúdo para todos os clientes. */
export type HelpCat = "primeiros-passos" | "tutoriais" | "conhecimento";

export const HELP_CATS: { key: HelpCat; label: string; text: string }[] = [
  { key: "primeiros-passos", label: "Primeiros passos", text: "O essencial para usar a área de membros desde o primeiro dia." },
  { key: "tutoriais", label: "Tutoriais", text: "Passo a passo das tarefas que dependem de você." },
  { key: "conhecimento", label: "Base de conhecimento", text: "O método, as regras do CFM, os números e os planos." },
];

export type Block = { h: string } | { p: string } | { list: string[] } | { steps: string[] } | { note: string };

export interface Article { id: string; cat: HelpCat; title: string; summary: string; minutes: number; body: Block[] }

export const ARTICLES: Article[] = [
  {
    id: "bem-vindo", cat: "primeiros-passos", minutes: 2,
    title: "Bem-vindo à sua área de membros",
    summary: "O que você encontra em cada parte e por onde começar.",
    body: [
      { p: "Aqui fica tudo o que a DoctorBrand faz pela sua marca: o que está sendo produzido, o que precisa da sua aprovação e o que já entregamos." },
      { h: "O que tem em cada parte" },
      { list: [
        "Projeto: o resumo do seu projeto, a agenda com reuniões e captações, as entregas do mês e os materiais principais.",
        "Sua evolução: tudo o que já foi entregue, a sua etapa no método D.O.M.Í.N.I.O., as metas do trimestre e as conquistas.",
        "Conteúdo: o planejamento do feed. É aqui que você aprova os posts ou pede ajustes.",
        "Anúncios: os resultados das campanhas, quando o seu plano inclui tráfego pago.",
        "Ajuda: esta central, com tutoriais e respostas rápidas.",
      ] },
      { h: "Por onde começar" },
      { steps: ["Abra Conteúdo e veja se há posts aguardando a sua aprovação.", "Confira a agenda no Projeto para saber a data da próxima reunião ou captação.", "Leia o tutorial de aprovação, leva dois minutos."] },
    ],
  },
  {
    id: "aprovar-post", cat: "primeiros-passos", minutes: 2,
    title: "Como aprovar um post",
    summary: "Nada vai ao ar sem a sua aprovação registrada.",
    body: [
      { p: "Todo post passa por você antes de ser publicado. A aprovação fica registrada com data e hora." },
      { steps: [
        "Abra Conteúdo. Os posts com a bolinha amarela estão aguardando você.",
        "Toque no post para ver a legenda, as imagens e a prévia de como ele fica no seu feed.",
        "Se estiver tudo certo, toque em Aprovar. O próximo post aguardando abre em seguida.",
        "Se quiser mudar algo, toque em Pedir ajuste e escreva o que mudar.",
      ] },
      { note: "Não conseguiu aprovar a tempo? O post não é publicado. A equipe remaneja a data e avisa você." },
    ],
  },
  {
    id: "pedir-ajuste", cat: "primeiros-passos", minutes: 1,
    title: "Como pedir um ajuste",
    summary: "Como descrever a mudança para a equipe acertar na primeira.",
    body: [
      { steps: ["No post, toque em Pedir ajuste.", "Se o ajuste for numa imagem específica do carrossel, toque nela para marcar.", "Escreva o que mudar, com o máximo de clareza.", "Envie. A equipe recebe na hora e o post volta para você depois de ajustado."] },
      { h: "Dicas para um ajuste certeiro" },
      { list: ["Diga o que mudar e, se puder, como deveria ficar: \"trocar 'procedimento' por 'cirurgia' na segunda linha\".", "Informação técnica errada? Escreva o dado correto. Você é quem assina a parte clínica.", "Um pedido por post, com todos os pontos juntos, agiliza o ajuste."] },
    ],
  },
  {
    id: "como-trabalhamos", cat: "primeiros-passos", minutes: 3,
    title: "Como a DoctorBrand trabalha com você",
    summary: "O ciclo de cada mês, do planejamento à publicação.",
    body: [
      { p: "Cada mês segue o mesmo ciclo. Assim você sabe o que esperar e quando a sua participação é necessária." },
      { steps: [
        "Planejamento: definimos os temas do período a partir dos seus pilares e objetivos.",
        "Roteiros: escrevemos com a sua forma de falar. Você valida a parte técnica.",
        "Captação: gravamos com você, no consultório ou em outro local combinado.",
        "Edição e design: vídeos, carrosséis e capas no padrão visual da sua marca.",
        "Aprovação: cada peça chega para você em Conteúdo.",
        "Publicação: a equipe publica o que foi aprovado, no dia e horário planejados.",
        "Acompanhamento: na reunião mensal olhamos resultados e ajustamos o próximo ciclo.",
      ] },
      { note: "A marca propõe a forma. Você assina a substância." },
    ],
  },
  {
    id: "captacao", cat: "tutoriais", minutes: 3,
    title: "Como se preparar para a captação",
    summary: "O checklist para o dia de gravação render o máximo.",
    body: [
      { h: "Na semana anterior" },
      { list: ["Leia os roteiros em Materiais, no lugar Roteiros vigentes. Não precisa decorar: vamos gravar com as suas palavras.", "Reserve o horário inteiro sem pacientes. Uma captação costuma levar cerca de 4 horas.", "Se algum conteúdo tiver paciente, confirme a autorização por escrito antes."] },
      { h: "Roupa e aparência" },
      { list: ["Leve 2 ou 3 trocas em cores sólidas. Evite listras finas, xadrez pequeno e logos grandes.", "Jaleco limpo e passado, se ele fizer parte da sua imagem.", "Cabelo e barba como você se sente bem. Nada de novidade no dia."] },
      { h: "No dia" },
      { list: ["Consultório organizado, sem papéis e objetos pessoais à vista.", "Água por perto e intervalos curtos entre os blocos.", "Fale como fala com um paciente. A naturalidade é o que mais gera confiança."] },
    ],
  },
  {
    id: "ler-anuncios", cat: "tutoriais", minutes: 3,
    title: "Como ler a sua página de anúncios",
    summary: "O que cada número significa e como saber se está bom.",
    body: [
      { p: "A página Anúncios mostra os resultados das campanhas no Meta (Instagram e Facebook) e, quando houver, no Google." },
      { list: [
        "Investimento: quanto foi gasto em mídia no período escolhido.",
        "Contatos: conversas iniciadas pelo anúncio (WhatsApp ou Direct) e cadastros de formulário.",
        "Custo por contato: o investimento dividido pelos contatos. É o principal indicador de eficiência.",
        "Pessoas alcançadas: quantas pessoas diferentes viram os anúncios.",
        "Cliques e visitas: aparece quando as campanhas do período são de alcance ou visitas ao perfil.",
      ] },
      { p: "Use os botões 7 dias, 30 dias e Este mês para mudar o período. Os números se atualizam a cada 15 minutos." },
      { note: "Custo por contato é só metade da história. O que importa no fim é quantos contatos viram consulta, e isso depende também do atendimento." },
    ],
  },
  {
    id: "evolucao", cat: "tutoriais", minutes: 2,
    title: "Como acompanhar entregas, metas e conquistas",
    summary: "Entenda a página Sua evolução.",
    body: [
      { list: [
        "Entregas concluídas: tudo o que a equipe produziu para você, direto do nosso sistema de tarefas.",
        "Sua jornada no método: em qual das 7 etapas do D.O.M.Í.N.I.O. o seu projeto está e qual é a próxima.",
        "Metas do trimestre: o objetivo combinado com você e o progresso de cada meta. Algumas se atualizam sozinhas.",
        "Conquistas: selos que você ganha ao atingir marcos, como a primeira captação ou 100 entregas.",
      ] },
      { p: "As metas são definidas com você no início de cada trimestre. Quer mudar alguma? Fale com a equipe." },
    ],
  },
  {
    id: "materiais", cat: "tutoriais", minutes: 1,
    title: "Onde encontrar os seus materiais",
    summary: "Os seis lugares fixos e o que fazer se um link não abrir.",
    body: [
      { p: "Os materiais principais ficam no Projeto, sempre nos mesmos lugares:" },
      { list: ["Pasta do projeto", "Identidade visual", "Guia da marca", "Roteiros vigentes", "Planejamento vigente", "Site e página de links"] },
      { p: "Cada lugar mostra sempre a versão mais recente. As anteriores continuam guardadas na pasta do projeto." },
      { note: "Um link pediu acesso? Entre com a conta Google do seu e-mail cadastrado ou peça acesso pelo próprio link. A equipe libera no mesmo dia." },
    ],
  },
  {
    id: "metodo", cat: "conhecimento", minutes: 3,
    title: "O método D.O.M.Í.N.I.O.",
    summary: "As 7 etapas da Arquitetura de Autoridade DoctorBrand.",
    body: [
      { p: "A DoctorBrand não faz só redes sociais. Construímos autoridade em etapas, e cada uma sustenta a seguinte." },
      { steps: METODO.map((m) => `${m.nome}: ${m.texto}`) },
      { p: "Em Sua evolução você vê em que etapa o seu projeto está." },
    ],
  },
  {
    id: "cfm", cat: "conhecimento", minutes: 3,
    title: "Publicidade médica e as regras do CFM",
    summary: "O essencial da Resolução CFM 2.336/2023, que orienta todo o seu conteúdo.",
    body: [
      { p: "A Resolução CFM 2.336/2023 define como o médico pode se comunicar nas redes. A equipe revisa cada peça por essas regras antes de chegar a você." },
      { h: "O que sempre aparece" },
      { list: ["Nome, CRM e, ao divulgar especialidade, o RQE.", "Informação correta e com finalidade educativa."] },
      { h: "O que evitamos" },
      { list: ["Prometer ou garantir resultado.", "Superlativos e comparações, como \"o melhor\" ou \"o único\".", "Sensacionalismo e autopromoção exagerada.", "Imagens de pacientes sem autorização ou fora de contexto educativo."] },
      { note: "Antes e depois e depoimentos exigem cuidado especial. A equipe avalia caso a caso com você." },
    ],
  },
  {
    id: "glossario", cat: "conhecimento", minutes: 3,
    title: "Glossário dos números",
    summary: "Alcance, engajamento, custo por contato e outros termos.",
    body: [
      { list: [
        "Alcance: pessoas diferentes que viram o conteúdo ou o anúncio.",
        "Impressões: quantas vezes o conteúdo apareceu, contando repetições.",
        "Frequência: média de vezes que cada pessoa viu o anúncio.",
        "Engajamento: curtidas, comentários, compartilhamentos e salvamentos.",
        "Salvamentos: o sinal mais forte de que o conteúdo foi útil.",
        "Contato ou lead: alguém que iniciou conversa ou deixou os dados pelo anúncio.",
        "Custo por contato (CPL): investimento dividido pelos contatos.",
        "CPC: custo por clique no anúncio.",
        "CTR: porcentagem de quem viu e clicou.",
      ] },
    ],
  },
  {
    id: "planos", cat: "conhecimento", minutes: 2,
    title: "Os planos DoctorBrand",
    summary: "O que cada plano inclui e como o projeto evolui.",
    body: [
      { p: "Os planos se somam: cada um inclui tudo do anterior." },
      ...(["core", "growth", "black"] as const).flatMap((k) => [{ h: `${PLANS[k].name}: ${PLANS[k].tagline}` }, { list: PLANS[k].includes }] as Block[]),
      { note: "Quer saber como o próximo plano ficaria no seu projeto? Em Sua evolução há um atalho para falar com a equipe." },
    ],
  },
  {
    id: "faq", cat: "conhecimento", minutes: 2,
    title: "Perguntas frequentes",
    summary: "Respostas rápidas para as dúvidas mais comuns.",
    body: [
      { h: "Quem publica os posts?" }, { p: "A equipe DoctorBrand, depois da sua aprovação, no dia e horário planejados." },
      { h: "Posso sugerir temas?" }, { p: "Sempre. Mande pelo WhatsApp da equipe ou traga para a reunião mensal." },
      { h: "Minha secretária pode ter acesso?" }, { p: "Pode. Peça à equipe um acesso separado para ela." },
      { h: "Esqueci a senha. E agora?" }, { p: "Fale com a equipe. Criamos uma senha nova na hora." },
      { h: "Os números de anúncios são em tempo real?" }, { p: "Quase: atualizam a cada 15 minutos, direto das plataformas." },
    ],
  },
];

export const article = (id: string) => ARTICLES.find((a) => a.id === id);

/** Texto corrido do artigo, para a busca. */
export function searchText(a: Article): string {
  const parts = a.body.map((b) => ("h" in b ? b.h : "p" in b ? b.p : "note" in b ? b.note : "list" in b ? b.list.join(" ") : b.steps.join(" ")));
  return [a.title, a.summary, ...parts].join(" ");
}
