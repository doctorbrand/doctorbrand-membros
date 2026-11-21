"use client";

import { useEffect, useRef, useState } from "react";
import { verSenhaAction } from "@/app/cliente/[slug]/acessos/actions";
import { CopyIcon, EyeIcon, EyeOffIcon } from "@/components/Icons";

async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

/** Botão pequeno de copiar, com retorno de "Copiado". */
export function Copiar({ texto, label = "Copiar" }: { texto: string; label?: string }) {
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <button type="button" className="cofre-icon" aria-label={label} title={label} onClick={async () => { setOk(await copiar(texto)); setTimeout(() => setOk(null), 1500); }}>
      {ok === null ? <CopyIcon size={15} /> : <span className="cofre-mini">{ok ? "Copiado" : "Não deu"}</span>}
    </button>
  );
}

/** Senha fechada. O olho busca a senha no servidor (fica registrado quem viu) e fecha sozinha em 30 segundos. */
export function SenhaOculta({ slug, id }: { slug: string; id: string }) {
  const [senha, setSenha] = useState<string | null>(null);
  const [aberta, setAberta] = useState(false);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function buscar(): Promise<string | null> {
    if (senha !== null) return senha;
    setOcupado(true); setMsg("");
    const r = await verSenhaAction(slug, id).catch(() => ({ ok: false, message: "Não consegui abrir agora." } as { ok: boolean; senha?: string; message?: string }));
    setOcupado(false);
    if (!r.ok || r.senha === undefined) { setMsg(r.message ?? "Não consegui abrir agora."); return null; }
    setSenha(r.senha);
    return r.senha;
  }

  function fecharDepois() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setAberta(false); setSenha(null); }, 30_000);
  }

  async function alternar() {
    if (aberta) { setAberta(false); setSenha(null); return; }
    if ((await buscar()) !== null) { setAberta(true); fecharDepois(); }
  }

  const [copiado, setCopiado] = useState<boolean | null>(null);
  async function copiarSenha() {
    const s = await buscar();
    if (s === null) return;
    setCopiado(await copiar(s));
    if (!aberta) setSenha(null);
    setTimeout(() => setCopiado(null), 1500);
  }

  return (
    <span className="cofre-val">
      <span className={`cofre-secret ${aberta ? "is-open" : ""}`} aria-live="polite">{aberta && senha !== null ? senha : "••••••••••"}</span>
      <button type="button" className="cofre-icon" onClick={alternar} disabled={ocupado} aria-label={aberta ? "Esconder senha" : "Mostrar senha"} title={aberta ? "Esconder senha" : "Mostrar senha"}>
        {aberta ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
      </button>
      <button type="button" className="cofre-icon" onClick={copiarSenha} disabled={ocupado} aria-label="Copiar senha" title="Copiar senha">
        {copiado === null ? <CopyIcon size={15} /> : <span className="cofre-mini">{copiado ? "Copiado" : "Não deu"}</span>}
      </button>
      {msg && <span className="cofre-err">{msg}</span>}
    </span>
  );
}

/** Campo de senha no formulário, fechado, com o olho para conferir o que foi digitado. */
export function CampoSenha({ temSenha }: { temSenha: boolean }) {
  const [ver, setVer] = useState(false);
  return (
    <span className="cofre-pass">
      <input name="senha" type={ver ? "text" : "password"} autoComplete="new-password" spellCheck={false} placeholder={temSenha ? "Deixe em branco para manter a atual" : "Senha"} className="ct-input" />
      <button type="button" className="cofre-icon" onClick={() => setVer((v) => !v)} aria-label={ver ? "Esconder o que digitei" : "Ver o que digitei"} title={ver ? "Esconder" : "Ver"}>
        {ver ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
      </button>
    </span>
  );
}
