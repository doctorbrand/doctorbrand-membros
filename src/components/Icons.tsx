/** Ícones de traço fino (estilo SF Symbols), cor herdada do texto. Nunca usar emoji na interface. */
type P = { size?: number; className?: string };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const EyeIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
export const MenuIcon = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const CheckIcon = ({ size = 14, className }: P) => <svg {...base(size)} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const AlertIcon = ({ size = 14, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></svg>;
export const TrashIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" /></svg>;
export const PencilIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" /></svg>;
export const RefreshIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" /></svg>;
export const ChevronLeftIcon = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><path d="m14.5 6-6 6 6 6" /></svg>;
export const ChevronRightIcon = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><path d="m9.5 6 6 6-6 6" /></svg>;
export const CalendarIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>;
export const EyeOffIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.9 3.8M6.6 6.6C3.6 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></svg>;
export const ArrowRightIcon = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const XIcon = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const ClockIcon = ({ size = 14, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
