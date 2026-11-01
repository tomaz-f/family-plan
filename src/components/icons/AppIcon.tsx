import React from 'react';
import { EDUSITES_SVGS, EdusitesIconName } from './edusitesSvgs';

export const ICON_ALIAS_MAP: Record<string, EdusitesIconName> = {
  // Lucide / English legacy names
  'Home': 'casa',
  'ShoppingBag': 'sacola',
  'ShoppingCart': 'carrinho-compras',
  'Car': 'carro',
  'HeartPulse': 'coracao',
  'Gamepad2': 'controle-game',
  'GraduationCap': 'formatura',
  'Tv': 'tv-tela',
  'Zap': 'raio',
  'Layers': 'ef-camadas',
  'Briefcase': 'carteira',
  'Sparkles': 'ia-brilho',
  'TrendingUp': 'grafico',
  'Landmark': 'banco',
  'RotateCcw': 'repetir',
  'PlusCircle': 'mais-circulo',
  'Utensils': 'talheres',
  'Film': 'filme',
  'MoreHorizontal': 'es-mais-opcoes',
  'Tag': 'etiqueta-preco',
  'Wallet': 'carteira',
  'CreditCard': 'cartao',
  'Gift': 'presente',
  'Plane': 'aviao',
  'Wifi': 'wifi',
  'Smartphone': 'celular',
  'Coffee': 'cafe',
  'Dumbbell': 'halteres',
  'PawPrint': 'pata',
  'Book': 'livro',
  'Fuel': 'posto-gasolina',

  // Portuguese common category terms
  'moradia': 'casa',
  'casa': 'casa',
  'mercado': 'carrinho-compras',
  'compras': 'sacola',
  'sacola': 'sacola',
  'carrinho': 'carrinho-compras',
  'transporte': 'carro',
  'carro': 'carro',
  'saude': 'coracao',
  'coracao': 'coracao',
  'lazer': 'controle-game',
  'jogos': 'controle-game',
  'educacao': 'formatura',
  'estudos': 'formatura',
  'formatura': 'formatura',
  'assinaturas': 'tv-tela',
  'streaming': 'tv-tela',
  'contas': 'raio',
  'energia': 'raio',
  'luz': 'raio',
  'outros': 'ef-camadas',
  'salario': 'dinheiro',
  'dinheiro': 'dinheiro',
  'renda': 'dinheiro',
  'extra': 'ia-brilho',
  'investimentos': 'investimento',
  'investimento': 'investimento',
  'alimentacao': 'talheres',
  'restaurante': 'refeicao',
  'refeicao': 'refeicao',
  'combustivel': 'posto-gasolina',
  'gasolina': 'posto-gasolina',
  'posto': 'posto-gasolina',
  'cartao': 'cartao',
  'banco': 'banco',
  'viagem': 'aviao',
  'aviao': 'aviao',
  'internet': 'wifi',
  'wifi': 'wifi',
  'celular': 'celular',
  'telefone': 'celular',
  'cafe': 'cafe',
  'academia': 'halteres',
  'fitness': 'halteres',
  'pet': 'pata',
  'pata': 'pata',
  'livros': 'livro',
  'livro': 'livro',
};

export interface AppIconProps {
  name?: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function resolveIconName(name?: string): EdusitesIconName {
  if (!name) return 'etiqueta-preco';
  if (name in EDUSITES_SVGS) {
    return name as EdusitesIconName;
  }
  if (name in ICON_ALIAS_MAP) {
    return ICON_ALIAS_MAP[name];
  }
  const clean = name.toLowerCase().trim().replace(/[-_\s]+/g, '-');
  if (clean in EDUSITES_SVGS) {
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
  const rawSvg = EDUSITES_SVGS[resolved] || EDUSITES_SVGS['etiqueta-preco'];

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
      dangerouslySetInnerHTML={{ __html: rawSvg }}
    />
  );
};

export default AppIcon;
