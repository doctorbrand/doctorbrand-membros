"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/Icons";

/** Campo de senha com botão para mostrar ou esconder o que foi digitado. */
export function PasswordField({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className={`${className ?? ""} pr-11`} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Esconder senha" : "Mostrar senha"} title={show ? "Esconder senha" : "Mostrar senha"} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full text-[var(--brand-mute)] hover:text-[var(--brand-cream)]">
        {show ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  );
}
