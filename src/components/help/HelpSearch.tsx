"use client";

import Link from "next/link";
import { useState } from "react";
import { SearchIcon } from "@/components/Icons";

type Item = { id: string; title: string; summary: string; cat: string; text: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca na Central de Ajuda: filtra enquanto digita, em todos os artigos. */
export function HelpSearch({ items, suffix }: { items: Item[]; suffix: string }) {
  const [q, setQ] = useState("");
  const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
  const score = (i: Item) => words.reduce((a, w) => a + (norm(i.title).includes(w) ? 3 : 0) + (norm(i.summary).includes(w) ? 1 : 0), 0);
  const hits = words.length ? items.filter((i) => words.every((w) => norm(i.text).includes(w))).sort((a, b) => score(b) - score(a)) : [];
  return (
    <div className="hc-search">
      <label className="hc-search-box">
        <SearchIcon size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busque por aprovar, captação, CPL, CFM..." aria-label="Buscar na Central de Ajuda" />
      </label>
      {words.length > 0 && (
        <div className="card hc-results">
          {hits.length ? hits.map((h) => (
            <Link key={h.id} href={`/ajuda/${h.id}${suffix}`} className="hc-result">
              <span className="block font-medium">{h.title}</span>
              <span className="block text-[13px] text-[var(--muted)]">{h.cat} · {h.summary}</span>
            </Link>
          )) : <p className="p-4 text-sm text-[var(--muted)]">Nada encontrado. Tente outra palavra ou fale com a equipe.</p>}
        </div>
      )}
    </div>
  );
}
