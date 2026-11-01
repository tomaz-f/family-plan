import React from 'react';
import { AppIcon, resolveIconName } from './icons/AppIcon';
import { EdusitesIconName } from './icons/edusitesSvgs';

export const PRIMARY_CATEGORY_ICONS = [
  // 1. Housing & Living (10)
  'casa',
  'predio',
  'sofa',
  'chave',
  'raio',
  'agua',
  'fogo',
  'wifi',
  'celular',
  'tv-tela',

  // 2. Groceries & Dining (8)
  'carrinho-compras',
  'cesta',
  'talheres',
  'cafe',
  'hamburguer',
  'pizza',
  'bebida',
  'maca',

  // 3. Transportation (9)
  'carro',
  'posto-gasolina',
  'onibus',
  'bicicleta',
  'moto',
  'aviao',
  'trem',
  'ferramentas',
  'estacionamento',

  // 4. Health & Fitness (6)
  'coracao',
  'hospital',
  'remedio',
  'halteres',
  'dente',
  'oculos',

  // 5. Education & Career (6)
  'formatura',
  'livro',
  'computador',
  'maleta',
  'cracha',
  'certificado',

  // 6. Leisure & Fun (6)
  'controle-game',
  'filme',
  'fone',
  'pata',
  'praia',
  'esporte',

  // 7. Personal & Shopping (7)
  'sacola',
  'presente',
  'etiqueta-preco',
  'tesoura',
  'roupa',
  'relogio',
  'diamante',

  // 8. Financial (13)
  'dinheiro',
  'carteira',
  'cofrinho',
  'grafico',
  'cartao',
  'recibo',
  'cofre',
  'banco',
  'investimento',
  'repetir',
  'ia-brilho',
  'estrela',
  'ef-camadas',
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
  color,
  size = 18,
  className = '',
  badgeSize,
}) => {
  const iconName: EdusitesIconName = resolveIconName(icon);
  const activeColor = color ?? '#6E5440';

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
        backgroundColor: `${activeColor}18`,
        color: activeColor,
      }}
    >
      <AppIcon name={iconName} size={size} color={activeColor} />
    </div>
  );
};

export default CategoryIcon;
