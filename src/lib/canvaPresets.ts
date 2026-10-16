import type { CanvaModelo } from "./brand";
import { lerCampos } from "./brand";

/**
 * Colunas dos 5 modelos de carrossel do design system DoctorBrand (perfil @fernandofontees), na ordem das
 * lâminas. Os nomes batem com os arquivos de importação para o Canva entregues com os modelos; no Canva,
 * cada coluna é ligada à caixa correspondente no "Criar em massa". Limites em palavras, pelo desenho.
 */
const P: { id: string; titulo: string; campos: string }[] = [
  { id: "db-autoridade", titulo: "Autoridade", campos: `
capa_titulo 10
capa_texto 14
argumento_eyebrow 3
argumento_titulo 8
argumento_texto 40
numero_numero 1
numero_titulo 8
numero_texto 40
citacao_frase 20
citacao_assinatura 4
resumo_titulo 6
resumo_item1 6
resumo_item2 6
resumo_item3 6
resumo_item4 6
resumo_item5 6
cta_titulo 8
cta_texto 16
cta_keyword 1` },
  { id: "db-editorial", titulo: "Editorial", campos: `
foto_capa foto
capa_script 4
capa_titulo 10
capa_texto 6
foto_zigue foto
zigue_bloco1 12
zigue_bloco2 10
zigue_bloco3 10
numero_antes 14
numero_rotulo 5
numero_numero 2
numero_rotulo2 5
numero_texto 25
foto_frase foto
frase_titulo 3
frase_italico 4
frase_texto 30
frase_fecho 8
foto_cta foto
cta_script 4
cta_titulo 3
cta_texto 14` },
  { id: "db-manchete", titulo: "Manchete", campos: `
foto_capa foto
capa_kicker 5
capa_titulo 3
capa_italico 4
capa_texto 12
foto_comparacao foto
comparacao_kicker 4
comparacao_titulo 5
comparacao_italico 4
card1_rotulo 2
card1_titulo 3
card1_texto 18
card2_rotulo 2
card2_titulo 3
card2_texto 18
texto_kicker 4
texto_titulo 5
texto_italico 6
texto_texto 40
cta_titulo 5
cta_italico 4
cta_texto 12
cta_keyword 1` },
  { id: "db-consultoria", titulo: "Consultoria", campos: `
foto_capa foto
capa_titulo 6
capa_italico 4
secao_rotulo 2
secao_texto 30
etapas_rotulo 3
etapas_titulo 12
etapa1_titulo 5
etapa1_texto 8
etapa2_titulo 5
etapa2_texto 8
etapa3_titulo 5
etapa3_texto 8
etapa4_titulo 5
etapa4_texto 8
foto_frase foto
frase_titulo 4
frase_italico 4
cta_rotulo 2
cta_titulo 3
cta_italico 2
cta_texto 12` },
  { id: "db-bastidor", titulo: "Bastidor", campos: `
foto_capa foto
capa_titulo 12
foto_fototexto foto
fototexto_titulo 14
fototexto_texto 25
foto_telas foto
telas_item1 4
telas_status1 2
telas_item2 4
telas_status2 2
telas_item3 4
telas_status3 2
telas_titulo 14
texto_titulo 14
texto_texto 25
foto_cta foto
cta_titulo 8
cta_texto 12
cta_keyword 1` },
];

export const MODELOS_DOCTORBRAND: CanvaModelo[] = P.map((m) => ({ id: m.id, titulo: m.titulo, campos: lerCampos(m.campos) }));

/** Clientes que usam os modelos do design system DoctorBrand. */
export const usaModelosDoctorbrand = (slug: string) => slug === "fernando-fontes";
