import { useId } from 'react';

export interface LibrePaqLogoProps {
  variant?: 'full' | 'horizontal' | 'mark-only' | 'wordmark-only';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'dark' | 'light';
  badge?: string;
  showSubtitle?: boolean;
  className?: string;
}

/**
 * Isotipo vectorial oficial de LibrePaq Pro.
 * Monograma geométrico "LP" entrelazado con estética de contabilidad moderna,
 * squircle zafiro/cobalto, trazo de partida doble y spark esmeralda de cuadre fiscal a $0.00.
 * Utiliza useId() para garantizar identificadores SVG únicos en el DOM.
 */
export function LibrePaqIcon({
  size = 'md',
  className = ''
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bgGradId = `lp-bg-${reactId}`;
  const lGradId = `lp-l-${reactId}`;
  const pGradId = `lp-p-${reactId}`;

  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14'
  };

  const dim = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${dim} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          {/* Gradiente principal zafiro a cobalto eléctrico */}
          <linearGradient id={bgGradId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E40AF" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>

          {/* Gradiente para el trazo "L" */}
          <linearGradient id={lGradId} x1="14" y1="11" x2="33" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F1F5F9" />
          </linearGradient>

          {/* Gradiente cian puro para el bucle "P" */}
          <linearGradient id={pGradId} x1="20" y1="11" x2="36" y2="25" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#7DD3FC" />
          </linearGradient>
        </defs>

        {/* Squircle Contenedor */}
        <rect width="48" height="48" rx="13" fill={`url(#${bgGradId})`} />
        
        {/* Borde sutil de brillo de cristal */}
        <rect
          width="46"
          height="46"
          x="1"
          y="1"
          rx="12"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />

        {/* Trazo "L" (Columna vertical y soporte horizontal de balance) */}
        <path
          d="M 15 13.5 C 15 12.1 16.1 11 17.5 11 L 19.5 11 C 20.9 11 22 12.1 22 13.5 L 22 29.5 L 32.5 29.5 C 33.9 29.5 35 30.6 35 32 C 35 33.4 33.9 34.5 32.5 34.5 L 17.5 34.5 C 16.1 34.5 15 33.4 15 32 Z"
          fill={`url(#${lGradId})`}
        />

        {/* Trazo "P" con hueco compuesto transparente (evenodd) */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M 22 11 L 28.5 11 C 32.6 11 35.5 13.9 35.5 18 C 35.5 22.1 32.6 25 28.5 25 L 22 25 Z M 26 15 L 28 15 C 29.9 15 31.5 16.3 31.5 18 C 31.5 19.7 29.9 21 28 21 L 26 21 Z"
          fill={`url(#${pGradId})`}
        />

        {/* Spark de Balance Contable: Punto verde esmeralda de cuadre $0.00 */}
        <circle cx="36.5" cy="11.5" r="3.2" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/**
 * Logotipo completo de LibrePaq.
 * Admite variantes horizontal (para header/sidebar), mark-only y full con badge.
 */
export function LibrePaqLogo({
  variant = 'horizontal',
  size = 'md',
  theme = 'dark',
  badge,
  showSubtitle = true,
  className = ''
}: LibrePaqLogoProps) {
  if (variant === 'mark-only') {
    return <LibrePaqIcon size={size} className={className} />;
  }

  const isDark = theme === 'dark';

  const titleSizes = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  const subtitleSizes = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm'
  };

  const titleCls = titleSizes[size] || titleSizes.md;
  const subCls = subtitleSizes[size] || subtitleSizes.md;

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <LibrePaqIcon size={size} />

      <div className="min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span
            className={`font-black tracking-tight ${titleCls} leading-none ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Libre
            <span className={isDark ? 'text-sky-400 font-black' : 'text-blue-600 font-black'}>
              Paq
            </span>
          </span>

          {badge && (
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                isDark
                  ? 'bg-blue-950/80 text-cyan-300 border-blue-600/50 shadow-2xs'
                  : 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
              }`}
            >
              {badge}
            </span>
          )}
        </div>

        {showSubtitle && (
          <p
            className={`${subCls} font-medium tracking-tight truncate leading-none mt-1 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Sistema Contable &amp; Fiscal
          </p>
        )}
      </div>
    </div>
  );
}

export default LibrePaqLogo;
