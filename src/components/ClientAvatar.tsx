"use client";

import { useState } from "react";

const initial = (name: string) => name.replace(/^(dra?\.?\s+)/i, "").charAt(0).toUpperCase();

/** Foto do perfil do Instagram do cliente (quando ligado); sem foto ou se o link expirar, a inicial. */
export function ClientAvatar({ name, photo, className = "sb-avatar" }: { name: string; photo?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (photo && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className={`${className} is-photo`} onError={() => setFailed(true)} />;
  }
  return <span className={className}>{initial(name)}</span>;
}
