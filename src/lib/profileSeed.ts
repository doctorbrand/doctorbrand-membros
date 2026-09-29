/** Ponto de partida do Perfil, importado uma vez do Painel de Tráfego (clients.ts). O que a equipe salvar na tela vale por cima. */
import type { ClientProfile } from "./profile";

export const PROFILE_SEED: Record<string, ClientProfile> = {
 "vivian-ferrari": {
  "publico": "Mulheres 35–60, alta renda. Público pagante confirmado 35+ (benchmark 11/09): converte a ~R$5. Seguidor converte pior que estranho; fonte da audiência importa mais que idade.\nRegião: Zona Sul (Leblon, raio 5 km); Barra da Tijuca (raio 8 km); Icaraí / Niterói (raio 10 km)\nFaixa etária alvo: 35 a 60 anos",
  "servicos": "Up Lifting (facelift)\nMastopexia\nBlefaroplastia\nPrótese de mama",
  "playbook": "Objetivo no tráfego pago: Conversas no Instagram (DM) e formulário de avaliação para Up Lifting (lifting facial autoral), Mastopexia e Blefaroplastia. Perfil funciona como landing page do pago.\nAprendizados do tráfego pago:\n- Público 35+ converte a ~R$5 por conversa e responde por 75% do volume (benchmark de 4 contas, 11/09). A variável que importa é a fonte da audiência, não a idade.\n- Desmistificação funciona: 'Nem toda mulher que busca mastopexia quer aumentar o volume' teve 56% de continuidade de conversa (n=440), o melhor da conta.\n- Seguidor converte pior que estranho (quente: 1 em 7 passa da 2ª mensagem). Distribuição vale pra alcance, não pra conversão.\n- 'Nem todo lifting precisa transformar': 8,3% de CTR no pago, mas 2,4% de conversão. É criativo de topo, não de captação.\n- 76% das conversas de Up Lifting morrem antes da 3ª mensagem: falta conteúdo pré-decisão (cara de feita, cicatriz, pós, indicação).\n- Geo: cidade inteira trazia leads de Penha/Jacarepaguá/Campo Grande. Raios de alta renda (Leblon, Barra, Icaraí) desde 22/07 e correção em 15/09."
 },
 "viegas": {
  "publico": "Mulheres 25–50 interessadas em cirurgia mamária (técnica R24R, recuperação funcional em 24h).\nRegião: Rio de Janeiro; Barra e Zona Sul",
  "servicos": "Prótese de mama (R24R)\nMastopexia\nLipoaspiração\nAbdominoplastia",
  "playbook": "Objetivo no tráfego pago: Conta operada por agência externa. A DoctorBrand só observa: serve de benchmark de CPL e de estrutura. Nenhuma ação é executada aqui.\nAprendizados do tráfego pago:\n- Conta de agência externa usada como benchmark: CPL histórico ~R$11 por conversa e Google com CPA ~R$21 em campanha de procedimentos.\n- Análise de 103 dias (jun–set/2026) no vault: estrutura por procedimento (prótese, mastopexia) com públicos de engajamento e LAL de pacientes."
 },
 "carlos-picasso": {
  "publico": "Mulheres 28–55, Rio de Janeiro, avessas ao excesso estético. Base de 58k seguidores. Públicos prontos: Seguidores IG, Engajamento 180/90/30 dias.\nRegião: Zona Sul (Leblon, raio 5 km); Barra da Tijuca (raio 8 km); Icaraí / Niterói (raio 10 km)\nFaixa etária alvo: 28 a 55 anos",
  "servicos": "Lift Facial\nLipo Definição\nPrótese de Mama",
  "playbook": "Objetivo no tráfego pago: Fase 1 (atual): ganho de seguidores — meta 80k em 6 meses, projeção realista 66–70k. Métrica de topo: custo por visita ao perfil ≤ R$0,30. Fase 2: converter a base em consultas (Lift Facial, Lipo Definição, Prótese).\nAprendizados do tráfego pago:\n- Topo: 'Quero entender sua história' faz R$0,19 por visita ao perfil; 'Hoje foi dia de transformar' fazia R$0,70 (3,7x pior) e foi pausada em 11/09.\n- Estratégia em 2 fases: primeiro seguidores (base de 58k), depois conversão dessa base. Fase 2 ainda sem criativo nos conjuntos.\n- Campanhas de topo criadas com Brasil inteiro: 78% da verba de 30 dias caiu fora do RJ. Geo por raio é obrigatória.\n- Posicionamento: Pitanguy + naturalidade, avesso ao excesso estético. Pacientes internacionais como prova social."
 },
 "flavio-pinheiro": {
  "publico": "Reabilitação oral 40–65 (implantes, prótese) e estética 25–45 (lentes de porcelana). Ilha do Governador e Zona Norte.\nRegião: Ilha do Governador (sede); Rio de Janeiro + Niterói (padrão)",
  "servicos": "Implantes\nLentes de porcelana\nPrótese\nClareamento",
  "playbook": "Objetivo no tráfego pago: Conversas (DM / WhatsApp) para avaliação na Dream Smile Odontologia. Benchmark histórico de CPL R$13–24; pausa da campanha 'FFE' em 26/08 derrubou o CPL de R$21 para R$12.\nAprendizados do tráfego pago:\n- Pausar a campanha 'FFE - DrLe - Flavio' em 26/08 derrubou o CPL do mês de R$21,21 para R$11,77.\n- Dois públicos distintos: reabilitação 40–65 (implantes/prótese) e estética 25–45 (lentes). Não misturar no mesmo conjunto.\n- Direção estratégica (ago/2026): Dra. Carol como rosto da Dream Smile no modelo Nive — prova/risco zero como grupo prioritário de criativos."
 },
 "eric-reis": {
  "publico": "Melhor célula: feminino 35–44 (CPL R$3,53). Feminino converte a metade do custo do masculino. Filho/decisor 30–50 para catarata dos pais. Zona Sul alta renda.\nRegião: Zona Sul do Rio (10 bairros)\nFaixa etária alvo: 30 a 55 anos",
  "servicos": "Catarata\nCirurgia refrativa\nConsulta oftalmológica",
  "playbook": "Objetivo no tráfego pago: Conversas para consulta e cirurgia (catarata, refrativa). Benchmark oftalmologia: bom R$8 / alvo R$15 / ruim R$25. Estrutura segmentada por idade desde 11/09.\nAprendizados do tráfego pago:\n- Feminino converte a R$5,03 (29 conversas) contra masculino R$9,56 (7). Melhor célula: feminino 35–44 a R$3,53.\n- Segmentar por idade (estrutura 11/09) em vez de deixar 20–65 com Advantage: a conta estava aprendendo que o público era idoso.\n- Roteiro 'O Neto' escrito para o filho/decisor 30–50 (catarata dos pais) é o ângulo de público mais promissor.\n- Benchmark oftalmologia: bom R$8 / alvo R$15 / ruim R$25 por conversa."
 },
 "erica-barros": {
  "publico": "Mulheres 30–55 de Tijuca e Ilha do Governador; quem quer resultado sem cirurgia e sem downtime.\nRegião: Tijuca (raio 8 km); Ilha do Governador (raio 8 km)\nFaixa etária alvo: 30 a 55 anos",
  "servicos": "Toxina botulínica\nSculptra\nPreenchimento\nLiftera\nManchas\nRemoção de tatuagem\nSkinbooster",
  "playbook": "Objetivo no tráfego pago: Captar avaliações para procedimentos injetáveis e tecnologias (toxina, Sculptra, Liftera) via DM; Google captura demanda comprovada (manchas, tatuagem, skinbooster).\nAprendizados do tráfego pago:\n- Google já captava com demanda comprovada (manchas, tatuagem, skinbooster) antes do Meta ativar.\n- Verba não comporta 1 campanha por procedimento: campanha âncora agrupando injetáveis + conjunto 'sem downtime' pra quem não quer operar.\n- Campanhas legado de alcance e views (vaidade) geraram zero leads."
 },
 "danilo-tacinari": {
  "publico": "Mulheres 30–55. Base de 3,8k seguidores exaurida (freq 3,8). Diagnóstico 11/09: o problema não é idade, é a fonte da audiência — carteira de pacientes como seed (LAL) é a alavanca.\nRegião: Niterói / Icaraí (raio 12 km) — praça principal; Leblon (raio 5 km); Barra da Tijuca (raio 8 km)\nFaixa etária alvo: 30 a 55 anos",
  "servicos": "Mamoplastia Estruturada\nContorno Pós-Bariátrica\nLipo HD\nFacelifting",
  "playbook": "Objetivo no tráfego pago: Conversas e formulário para avaliação. CPL alvo R$15–20. Reestruturação V2 (13/08): 60% frio / 25% distribuição / 15% quente.\nAprendizados do tráfego pago:\n- Base de 3,8k seguidores exaurida (frequência 3,8, alcance 1.299): reestruturação V2 em 13/08 inverteu pra 60% frio / 25% distribuição / 15% quente.\n- Diagnóstico 11/09: CPL alto não é problema de idade — o ranking de CPL da conta está invertido em relação à qualidade do público. Carteira de pacientes como seed (LAL) é a alavanca.\n- Lipo HD a R$50/dia com CPL R$39,66 (2,6x o alvo) comia o budget; campanha de formulário ficou dias sem lead — corrigir o form antes de reinvestir.\n- Praça principal é Niterói/Icaraí (leilão mais raso); Botafogo saiu da geo em 13/08."
 },
 "jose-mauro": {
  "publico": "Mulheres 25–50, Rio de Janeiro.\nRegião: Rio de Janeiro + Niterói",
  "servicos": "Cirurgia plástica geral",
  "playbook": "Objetivo no tráfego pago: Conta não é mais operada pela DoctorBrand. Exibida só para acompanhamento histórico (benchmark ~R$7 por conversa).\nAprendizados do tráfego pago:\n- Quando operada pela DoctorBrand, a conta fazia ~R$7 por conversa — referência de CPL pra cirurgia plástica no RJ."
 }
};
