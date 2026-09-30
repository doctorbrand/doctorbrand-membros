"use client";

import { DocIcon } from "@/components/Icons";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="ct-btn inline-flex items-center gap-1.5"><DocIcon size={15} /> Salvar em PDF</button>;
}
