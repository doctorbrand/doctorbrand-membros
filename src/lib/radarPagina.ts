const FRENTES: [string, string][] = [["plastica", "Cirurgia plástica"], ["dermatologia", "Dermatologia"], ["oftalmologia", "Oftalmologia"], ["odontologia", "Odontologia"], ["tecnologia", "Tecnologia"], ["mercado", "Mercado médico"]];

/**
 * Ajustes na página do Radar da equipe, só quando aberta pela área:
 * filtro por frente e notícias de alerta (mortes, erros, interdições) escondidas, com um botão "Alertas" para vê-las.
 * Cada troca só acontece se o trecho existir; se a página do Radar mudar, ela abre como sempre.
 */
export function comFrentesEAlertas(html: string): string {
  const filtro = 'let list=state.items.filter(it=>{';
  const contador = '<span class="count" id="count"></span>';
  const inicio = "const saved=window.__RADAR_CODIGO||read(KEY);";
  if (!html.includes(filtro) || !html.includes(contador) || !html.includes(inicio)) return html;
  const opcoes = FRENTES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  return html
    .replaceAll("Radar da Cirurgia Plástica", "Radar DoctorBrand")
    .replace(filtro, `${filtro}\n    if(state.alertas ? it.tom!=="alerta" : it.tom==="alerta") return false;\n    if(state.frente && !(it.areas||[]).includes(state.frente)) return false;`)
    .replace(contador, `<select id="frente" aria-label="Frente"><option value="">Todas as frentes</option>${opcoes}</select><button class="chip" type="button" id="alertasBtn" aria-pressed="false" title="Mortes, erros, interdições e outros casos negativos">Alertas</button>${contador}`)
    .replace(inicio, `document.getElementById("frente").addEventListener("change",e=>{state.frente=e.target.value;state.limit=40;render();});\ndocument.getElementById("alertasBtn").addEventListener("click",e=>{state.alertas=!state.alertas;e.currentTarget.setAttribute("aria-pressed",String(state.alertas));state.limit=40;render();});\n${inicio}`);
}
