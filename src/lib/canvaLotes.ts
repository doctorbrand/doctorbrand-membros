import { readDoc, writeDoc } from "./store";
import type { Lote } from "./canvaLote";

/** Lotes enviados ao Canva (só no servidor): a ordem dos posts de cada planilha, para casar o ZIP na volta. */
const doc = (slug: string) => `canva-lotes/${slug}`;

export async function getLotes(slug: string): Promise<Lote[]> {
  return readDoc<Lote[]>(doc(slug), []);
}

export async function saveLote(slug: string, lote: Lote): Promise<void> {
  const lotes = await getLotes(slug);
  await writeDoc(doc(slug), [lote, ...lotes.filter((l) => l.id !== lote.id)].slice(0, 12));
}
