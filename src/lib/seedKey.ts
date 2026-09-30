/**
 * Clientes cadastrados pela tela Clientes ganham o endereço a partir do nome (ex.: dr-brunno).
 * Para os dados levantados de antemão acharem o cliente certo, o endereço é comparado por nome.
 */
const MATCH: [RegExp, string][] = [
  [/brunno/, "brunno-bernardo"],
  [/^fernando$|fontes/, "fernando-fontes"],
];

export function seedKey(slug: string): string {
  return MATCH.find(([re]) => re.test(slug))?.[1] ?? slug;
}

/** O cliente já foi cadastrado com outro endereço que aponta para o mesmo levantamento. */
export function sameSeed(a: string, b: string): boolean {
  return a !== b && seedKey(a) === seedKey(b);
}
