/** Ícones de traço fino (estilo SF Symbols), cor herdada do texto. Nunca usar emoji na interface. */
type P = { size?: number; className?: string };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const EyeIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
export const MenuIcon = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const CheckIcon = ({ size = 14, className }: P) => <svg {...base(size)} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const AlertIcon = ({ size = 14, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></svg>;
export const TrashIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" /></svg>;
export const RefreshIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" /></svg>;
