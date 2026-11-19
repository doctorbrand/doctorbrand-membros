"use client";

import { useEffect, useState } from "react";
import { desinscreverAction, inscreverAction } from "@/app/notificacoes/actions";

function chave(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Estado = "carregando" | "sem-suporte" | "instalar-iphone" | "bloqueado" | "desligado" | "ligado";

function nomeDoAparelho(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return /Samsung|SM-/.test(ua) ? "Samsung" : "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Navegador";
}

/** Ativa as notificações neste aparelho. No iPhone, antes, guia a pôr a área na tela de início. */
export function PushSetup({ chavePublica, podeAtivar }: { chavePublica: string; podeAtivar: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [endpoint, setEndpoint] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEstado(ios && !instalado ? "instalar-iphone" : "sem-suporte");
        return;
      }
      if (Notification.permission === "denied") { setEstado("bloqueado"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      if (sub) { setEndpoint(sub.endpoint); setEstado("ligado"); } else setEstado("desligado");
    })().catch(() => setEstado("sem-suporte"));
  }, []);

  async function ativar() {
    setOcupado(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setEstado(perm === "denied" ? "bloqueado" : "desligado"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(chavePublica) });
      const r = await inscreverAction(JSON.parse(JSON.stringify(sub)), nomeDoAparelho());
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) { setEndpoint(sub.endpoint); setEstado("ligado"); } else await sub.unsubscribe().catch(() => undefined);
    } catch {
      setMsg({ ok: false, text: "Não consegui ativar neste aparelho. Tente de novo." });
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setOcupado(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe().catch(() => undefined);
      const r = await desinscreverAction(endpoint || sub?.endpoint || "");
      setMsg({ ok: r.ok, text: r.message });
      setEstado("desligado"); setEndpoint("");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "carregando") return <p className="text-[14px] text-[var(--muted)]">Verificando este aparelho...</p>;

  if (estado === "instalar-iphone") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[15px]">No iPhone, as notificações funcionam com a área na tela de início:</p>
        <ol className="nt-steps">
          <li><b>Toque em Compartilhar</b> na barra do Safari (o quadrado com a seta para cima).</li>
          <li>Escolha <b>Adicionar à Tela de Início</b> e confirme.</li>
          <li><b>Abra a DoctorBrand pelo ícone</b> novo e volte a esta tela para ativar.</li>
        </ol>
        <p className="text-[13px] text-[var(--muted)]">Precisa do iOS 16.4 ou mais novo.</p>
      </div>
    );
  }
  if (estado === "sem-suporte") return <p className="text-[14px] text-[var(--muted)]">Este navegador não recebe notificações. No celular, use o Safari (iPhone) ou o Chrome (Android).</p>;
  if (estado === "bloqueado") return <p className="text-[14px] text-[var(--muted)]">As notificações estão bloqueadas para a DoctorBrand neste aparelho. Libere nos ajustes do celular (Notificações › DoctorBrand) e volte aqui.</p>;

  return (
    <div className="flex flex-col gap-2">
      {estado === "ligado"
        ? <p className="text-[15px]"><span className="nt-dot is-on" aria-hidden />Ativadas neste aparelho.</p>
        : <p className="text-[15px]"><span className="nt-dot" aria-hidden />Desligadas neste aparelho.</p>}
      <div className="flex flex-wrap gap-2">
        {estado === "ligado"
          ? <button type="button" className="ct-btn" onClick={desativar} disabled={ocupado}>Desligar neste aparelho</button>
          : <button type="button" className="ct-btn ct-btn-dark ct-btn-lg" onClick={ativar} disabled={ocupado || !podeAtivar}>{ocupado ? "Ativando..." : "Ativar notificações"}</button>}
      </div>
      {!podeAtivar && estado !== "ligado" && <p className="text-[13px] text-[var(--muted)]">Entre com o seu usuário (e-mail e senha) para ativar.</p>}
      {msg && <p className={`text-[13px] ${msg.ok ? "text-[var(--muted)]" : "text-[#b3261e]"}`}>{msg.text}</p>}
    </div>
  );
}
