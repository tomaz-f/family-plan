import React from 'react';
import { AppIcon, resolveIconName } from './icons/AppIcon';
import { EdusitesIconName } from './icons/edusitesSvgs';

export const PRIMARY_CATEGORY_ICONS = [
  'casa',
  'carrinho-compras',
  'sacola',
  'carro',
  'posto-gasolina',
  'coracao',
  'controle-game',
  'formatura',
  'tv-tela',
  'raio',
  'ef-camadas',
  'carteira',
  'dinheiro',
  'ia-brilho',
  'investimento',
  'banco',
  'repetir',
  'mais-circulo',
  'talheres',
  'refeicao',
  'filme',
  'cartao',
  'presente',
  'aviao',
  'wifi',
  'celular',
  'cafe',
  'halteres',
  'pata',
  'livro',
  'etiqueta-preco',
] as const;

export const AVAILABLE_ICONS = PRIMARY_CATEGORY_ICONS;

export type AvailableIconKey = (typeof AVAILABLE_ICONS)[number];

export interface CategoryIconProps {
  icon?: string;
  color?: string;
  size?: number;
  className?: string;
  badgeSize?: 'sm' | 'md' | 'lg';
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  color = '#6E5440',
  size = 18,
  className = '',
  badgeSize,
}) => {
  const iconName: EdusitesIconName = resolveIconName(icon);

  if (!badgeSize) {
    return (
      <AppIcon
        name={iconName}
        size={size}
        color={color}
        className={className}
      />
    );
  }

  const sizeClasses =
    badgeSize === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : badgeSize === 'lg'
      ? 'w-11 h-11 rounded-xl'
      : 'w-9 h-9 rounded-xl';

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}
      style={{
        backgroundColor: `${color}18`,
        color: color,
      }}
    >
      <AppIcon name={iconName} size={size} color={color} />
    </div>
  );
};

export default CategoryIcon;
