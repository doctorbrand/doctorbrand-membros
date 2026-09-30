/** Obras de Claude Monet em domínio público (National Gallery of Art, Art Institute of Chicago, Musée d'Orsay, Musée Marmottan). */
export const MONET = [
  { id: "parasol", title: "Mulher com sombrinha", year: "1875" },
  { id: "ninfeias", title: "Ninfeias", year: "1906" },
  { id: "ponte", title: "A ponte japonesa", year: "1899" },
  { id: "papoulas", title: "Papoulas", year: "1873" },
  { id: "impressao", title: "Impressão, nascer do sol", year: "1872" },
];

/** Obra inicial: muda a cada minuto, então cada visita começa numa obra diferente. */
export function startingArt(): number {
  return Math.floor(Date.now() / 60_000) % MONET.length;
}
