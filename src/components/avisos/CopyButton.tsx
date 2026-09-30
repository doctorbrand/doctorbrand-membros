"use client";

import { useState } from "react";
import { CheckIcon, DocIcon } from "@/components/Icons";

export function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="ct-btn inline-flex items-center gap-1.5" onClick={async () => { await navigator.clipboard.writeText(text).catch(() => undefined); setOk(true); setTimeout(() => setOk(false), 1600); }}>
      {ok ? <CheckIcon /> : <DocIcon size={15} />} {ok ? "Copiado" : "Copiar"}
    </button>
  );
}
