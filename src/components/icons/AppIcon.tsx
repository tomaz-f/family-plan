import React from 'react';
import { EDUSITES_SVGS, EdusitesIconName } from './edusitesSvgs';
import { EXTRA_SVGS, LUCIDE_ICON_MAP, ICON_ALIAS_MAP } from './app/appBrandCatalog';

export { EXTRA_SVGS, LUCIDE_ICON_MAP, ICON_ALIAS_MAP };

export interface AppIconProps {
  name?: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function resolveIconName(name?: string): EdusitesIconName {
  if (!name) return 'etiqueta-preco';
  if (name in EDUSITES_SVGS || name in EXTRA_SVGS || name in LUCIDE_ICON_MAP) {
    return name as EdusitesIconName;
  }
  if (name in ICON_ALIAS_MAP) {
    return ICON_ALIAS_MAP[name];
  }
  const clean = name.toLowerCase().trim().replace(/[-_\s]+/g, '-');
  if (clean in EDUSITES_SVGS || clean in EXTRA_SVGS || clean in LUCIDE_ICON_MAP) {
    return clean as EdusitesIconName;
  }
  if (clean in ICON_ALIAS_MAP) {
    return ICON_ALIAS_MAP[clean];
  }
  return 'etiqueta-preco';
}

export const AppIcon: React.FC<AppIconProps> = ({
  name = 'etiqueta-preco',
  size = 20,
  color,
  className = '',
  style,
}) => {
  const resolved = resolveIconName(name);
  const rawSvg = EDUSITES_SVGS[resolved] || EXTRA_SVGS[resolved];

  if (rawSvg) {
    const isExtraSvg = resolved in EXTRA_SVGS;
    return (
      <span
        className={`app-icon inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full ${
          isExtraSvg ? '[&>svg]:stroke-current [&>svg]:fill-none' : '[&>svg]:fill-current'
        } ${className}`}
        style={{
          width: size,
          height: size,
          color,
          ...style,
        }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: rawSvg }}
      />
    );
  }

  const LucideIcon = LUCIDE_ICON_MAP[resolved];
  if (LucideIcon) {
    return (
      <span
        className={`app-icon inline-flex items-center justify-center shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          color,
          ...style,
        }}
        aria-hidden="true"
      >
        <LucideIcon size={size} color={color || 'currentColor'} strokeWidth={2.2} />
      </span>
    );
  }

  const fallbackSvg = EDUSITES_SVGS['etiqueta-preco'];
  return (
    <span
      className={`app-icon inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current ${className}`}
      style={{
        width: size,
        height: size,
        color,
        ...style,
      }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: fallbackSvg }}
    />
  );
};

export default AppIcon;
