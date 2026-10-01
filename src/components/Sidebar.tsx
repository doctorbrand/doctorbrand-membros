"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/Logo";
import {
  BellIcon, ChecklistIcon, ChevronLeftIcon, ChevronRightIcon, GearIcon, GridIcon, HelpIcon, HomeIcon, KeyIcon, LogoutIcon,
  MegaphoneIcon, MenuIcon, EyeIcon, SparkIcon, TrendIcon, UserIcon, UsersIcon, WandIcon, XIcon,
} from "@/components/Icons";

const ICONS = {
  home: HomeIcon, trend: TrendIcon, grid: GridIcon, megaphone: MegaphoneIcon, checklist: ChecklistIcon, spark: SparkIcon,
  help: HelpIcon, eye: EyeIcon, bell: BellIcon, users: UsersIcon, key: KeyIcon, gear: GearIcon, user: UserIcon, wand: WandIcon,
} as const;
export type IconKey = keyof typeof ICONS;

export interface NavItem { href: string; label: string; icon: IconKey; active: boolean }
export interface NavSection { title?: string; items: NavItem[] }

const COOKIE = "db_sb";

/** Menu lateral: recolhe para só ícones (lembra a escolha) e vira gaveta no celular. */
export function Sidebar({ sections, footer, user, client, home, initialCollapsed }: {
  sections: NavSection[]; footer: NavItem[]; user: string; client?: { name: string; sub?: string; switchHref?: string }; home: string; initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<{ label: string; y: number } | null>(null);
  const showTip = (e: React.MouseEvent<HTMLElement>, label: string) => {
    if (!collapsed || window.innerWidth <= 900) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, y: r.top + r.height / 2 });
  };
  const tipProps = (label: string) => ({ onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTip(e, label), onMouseLeave: () => setTip(null), onFocus: (e: React.FocusEvent<HTMLElement>) => showTip(e as unknown as React.MouseEvent<HTMLElement>, label), onBlur: () => setTip(null) });

  useEffect(() => {
    document.documentElement.dataset.sb = collapsed ? "min" : "full";
    document.cookie = `${COOKIE}=${collapsed ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const item = (i: NavItem) => {
    const Ic = ICONS[i.icon];
    return (
      i.href.startsWith("/api/")
        ? <a key={i.href + i.label} href={i.href} className="sb-item" aria-label={i.label} {...tipProps(i.label)}><Ic size={19} /><span className="sb-label">{i.label}</span></a>
        : <Link key={i.href + i.label} href={i.href} onClick={() => { setOpen(false); setTip(null); }} className={`sb-item ${i.active ? "is-on" : ""}`} aria-label={i.label} aria-current={i.active ? "page" : undefined} {...tipProps(i.label)}>
            <Ic size={19} />
            <span className="sb-label">{i.label}</span>
          </Link>
    );
  };

  return (
    <>
      <div className="sb-top">
        <Link href={home} aria-label="DoctorBrand, início" className="sb-logo"><span className="sb-mark is-sm"><LogoMark className="h-[18px] text-white" /></span><span className="font-semibold text-[15px] tracking-tight">DoctorBrand</span></Link>
        <button type="button" className="sb-burger" onClick={() => setOpen(true)} aria-label="Abrir menu"><MenuIcon /></button>
      </div>
      {open && <button type="button" className="sb-scrim" aria-label="Fechar menu" onClick={() => setOpen(false)} />}

      <aside className={`sb ${collapsed ? "is-min" : ""} ${open ? "is-open" : ""}`} aria-label="Menu">
        <div className="sb-head">
          <Link href={home} className="sb-logo" aria-label="DoctorBrand, início">
            <span className="sb-mark"><LogoMark className="h-[24px] text-white" /></span>
            <span className="sb-brand"><span className="block font-semibold text-[15.5px] tracking-tight leading-tight">DoctorBrand</span><span className="block text-[12px] text-[var(--muted)] leading-tight mt-0.5">Área de membros</span></span>
          </Link>
          <button type="button" className="sb-close" onClick={() => setOpen(false)} aria-label="Fechar menu"><XIcon size={18} /></button>
        </div>
        <button type="button" className="sb-toggle" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>
          {collapsed ? <ChevronRightIcon size={15} /> : <ChevronLeftIcon size={15} />}
        </button>

        {client && (
          <div className="sb-client" {...tipProps(client.name)}>
            <span className="sb-avatar">{client.name.replace(/^(dra?\.?\s+)/i, "").charAt(0).toUpperCase()}</span>
            <span className="sb-label min-w-0">
              <span className="block font-medium truncate">{client.name}</span>
              {client.switchHref ? <Link href={client.switchHref} className="block text-[12px] text-[var(--muted)] hover:text-[var(--ink)]">Trocar cliente</Link> : client.sub && <span className="block text-[12px] text-[var(--muted)] truncate">{client.sub}</span>}
            </span>
          </div>
        )}

        <nav className="sb-nav">
          {sections.filter((s) => s.items.length).map((s, n) => (
            <div key={n} className="sb-sec">
              {s.title && <p className="sb-title">{s.title}</p>}
              {s.items.map(item)}
            </div>
          ))}
        </nav>

        <div className="sb-foot">
          {footer.map(item)}
          <form action="/api/logout" method="post" className="sb-user">
            <span className="sb-avatar is-user"><UserIcon size={16} /></span>
            <span className="sb-label min-w-0 flex-1 truncate text-[13px]">{user}</span>
            <button className="sb-out" aria-label="Sair" title="Sair" {...tipProps("Sair")}><LogoutIcon size={17} /></button>
          </form>
        </div>
      </aside>
      {tip && <div className="sb-tip" style={{ top: tip.y }}>{tip.label}</div>}
    </>
  );
}
