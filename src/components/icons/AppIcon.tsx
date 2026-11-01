import React from 'react';
import {
  LucideIcon,
  Building2,
  Sofa,
  Key,
  Droplet,
  Flame,
  ShoppingBasket,
  Pizza,
  CupSoda,
  Apple,
  Bus,
  Bike,
  Train,
  Wrench,
  CircleParking,
  Hospital,
  Pill,
  Glasses,
  Laptop,
  Briefcase,
  IdCard,
  Award,
  Headphones,
  Umbrella,
  Trophy,
  Scissors,
  Shirt,
  Watch,
  Gem,
  PiggyBank,
  Receipt,
  Lock,
} from 'lucide-react';
import { EDUSITES_SVGS, EdusitesIconName } from './edusitesSvgs';

export const EXTRA_SVGS: Record<string, string> = {
  dente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3C4.2 3 2 5.2 2 8c0 3.3 1.8 6.5 3 9.5.8 2.1 2.2 3.5 3.5 3.5 1.5 0 2-1.5 3.5-1.5s2 1.5 3.5 1.5c1.3 0 2.7-1.4 3.5-3.5 1.2-3 3-6.2 3-9.5 0-2.8-2.2-5-5-5-2 0-3.5 1.5-4.5 1.5S9 3 7 3z"/></svg>',
  hamburguer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a1 1 0 0 0 1-1C20.5 5.5 16.5 3 12 3S3.5 5.5 3 10a1 1 0 0 0 1 1z"/><path d="M3 15h18"/><path d="M4 18h16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M6 15v1"/><path d="M10 15v1"/><path d="M14 15v1"/><path d="M18 15v1"/></svg>',
  moto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-3l-3 5h8l3-3h2"/><path d="m9 11-4 6.5"/><path d="m15 11 3.5 6.5"/></svg>',
};

export const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  predio: Building2,
  sofa: Sofa,
  chave: Key,
  agua: Droplet,
  fogo: Flame,
  cesta: ShoppingBasket,
  pizza: Pizza,
  bebida: CupSoda,
  maca: Apple,
  onibus: Bus,
  bicicleta: Bike,
  trem: Train,
  ferramentas: Wrench,
  estacionamento: CircleParking,
  hospital: Hospital,
  remedio: Pill,
  oculos: Glasses,
  computador: Laptop,
  maleta: Briefcase,
  cracha: IdCard,
  certificado: Award,
  fone: Headphones,
  praia: Umbrella,
  esporte: Trophy,
  tesoura: Scissors,
  roupa: Shirt,
  relogio: Watch,
  diamante: Gem,
  cofrinho: PiggyBank,
  recibo: Receipt,
  cofre: Lock,
};

export const ICON_ALIAS_MAP: Record<string, EdusitesIconName> = {
  // 1. Housing & Living
  'Home': 'casa',
  'House': 'casa',
  'casa': 'casa',
  'moradia': 'casa',
  'Building': 'predio',
  'Building2': 'predio',
  'predio': 'predio',
  'predios': 'predio',
  'condominio': 'predio',
  'Sofa': 'sofa',
  'Armchair': 'sofa',
  'sofa': 'sofa',
  'moveis': 'sofa',
  'Key': 'chave',
  'chave': 'chave',
  'aluguel': 'chave',
  'Zap': 'raio',
  'Bolt': 'raio',
  'raio': 'raio',
  'luz': 'raio',
  'energia': 'raio',
  'eletricidade': 'raio',
  'contas': 'raio',
  'Droplet': 'agua',
  'Water': 'agua',
  'agua': 'agua',
  'saneamento': 'agua',
  'Flame': 'fogo',
  'Gas': 'fogo',
  'fogo': 'fogo',
  'gas': 'fogo',
  'Wifi': 'wifi',
  'wifi': 'wifi',
  'internet': 'wifi',
  'Smartphone': 'celular',
  'Phone': 'celular',
  'celular': 'celular',
  'telefone': 'celular',
  'Tv': 'tv-tela',
  'tv': 'tv-tela',
  'tv-tela': 'tv-tela',
  'streaming': 'tv-tela',
  'assinaturas': 'tv-tela',

  // 2. Groceries & Dining
  'ShoppingCart': 'carrinho-compras',
  'carrinho-compras': 'carrinho-compras',
  'carrinho': 'carrinho-compras',
  'mercado': 'carrinho-compras',
  'supermercado': 'carrinho-compras',
  'ShoppingBasket': 'cesta',
  'Basket': 'cesta',
  'cesta': 'cesta',
  'feira': 'cesta',
  'Utensils': 'talheres',
  'talheres': 'talheres',
  'refeicao': 'refeicao',
  'alimentacao': 'talheres',
  'restaurante': 'refeicao',
  'Coffee': 'cafe',
  'cafe': 'cafe',
  'cafeteria': 'cafe',
  'Burger': 'hamburguer',
  'FastFood': 'hamburguer',
  'hamburguer': 'hamburguer',
  'lanche': 'hamburguer',
  'Pizza': 'pizza',
  'pizza': 'pizza',
  'Drink': 'bebida',
  'CupSoda': 'bebida',
  'Wine': 'bebida',
  'bebida': 'bebida',
  'bebidas': 'bebida',
  'bar': 'bebida',
  'Apple': 'maca',
  'maca': 'maca',
  'fruta': 'maca',
  'hortifruti': 'maca',

  // 3. Transportation
  'Car': 'carro',
  'carro': 'carro',
  'transporte': 'carro',
  'veiculo': 'carro',
  'Fuel': 'posto-gasolina',
  'GasPump': 'posto-gasolina',
  'posto-gasolina': 'posto-gasolina',
  'combustivel': 'posto-gasolina',
  'gasolina': 'posto-gasolina',
  'posto': 'posto-gasolina',
  'Bus': 'onibus',
  'onibus': 'onibus',
  'Bike': 'bicicleta',
  'Bicycle': 'bicicleta',
  'bicicleta': 'bicicleta',
  'Motorcycle': 'moto',
  'moto': 'moto',
  'Plane': 'aviao',
  'Airplane': 'aviao',
  'aviao': 'aviao',
  'viagem': 'aviao',
  'viagens': 'aviao',
  'Train': 'trem',
  'trem': 'trem',
  'metro': 'trem',
  'Wrench': 'ferramentas',
  'ferramentas': 'ferramentas',
  'mecanico': 'ferramentas',
  'oficina': 'ferramentas',
  'Parking': 'estacionamento',
  'estacionamento': 'estacionamento',

  // 4. Health & Fitness
  'Heart': 'coracao',
  'HeartPulse': 'coracao',
  'coracao': 'coracao',
  'saude': 'coracao',
  'Hospital': 'hospital',
  'Stethoscope': 'hospital',
  'hospital': 'hospital',
  'medico': 'hospital',
  'clinica': 'hospital',
  'Pill': 'remedio',
  'Medicine': 'remedio',
  'remedio': 'remedio',
  'remedios': 'remedio',
  'farmacia': 'remedio',
  'Dumbbell': 'halteres',
  'halteres': 'halteres',
  'academia': 'halteres',
  'fitness': 'halteres',
  'Tooth': 'dente',
  'dente': 'dente',
  'dentista': 'dente',
  'Glasses': 'oculos',
  'oculos': 'oculos',
  'otica': 'oculos',

  // 5. Education & Career
  'GraduationCap': 'formatura',
  'formatura': 'formatura',
  'educacao': 'formatura',
  'estudos': 'formatura',
  'faculdade': 'formatura',
  'Book': 'livro',
  'BookOpen': 'livro',
  'livro': 'livro',
  'livros': 'livro',
  'Laptop': 'computador',
  'computador': 'computador',
  'notebook': 'computador',
  'tecnologia': 'computador',
  'Briefcase': 'maleta',
  'maleta': 'maleta',
  'trabalho': 'maleta',
  'emprego': 'maleta',
  'IdCard': 'cracha',
  'cracha': 'cracha',
  'Award': 'certificado',
  'Certificate': 'certificado',
  'certificado': 'certificado',
  'curso': 'certificado',

  // 6. Leisure & Fun
  'Gamepad': 'controle-game',
  'Gamepad2': 'controle-game',
  'controle-game': 'controle-game',
  'lazer': 'controle-game',
  'jogos': 'controle-game',
  'games': 'controle-game',
  'Film': 'filme',
  'Movie': 'filme',
  'filme': 'filme',
  'cinema': 'filme',
  'Headphones': 'fone',
  'Music': 'fone',
  'fone': 'fone',
  'musica': 'fone',
  'PawPrint': 'pata',
  'pata': 'pata',
  'pet': 'pata',
  'pets': 'pata',
  'veterinario': 'pata',
  'Umbrella': 'praia',
  'praia': 'praia',
  'ferias': 'praia',
  'Trophy': 'esporte',
  'esporte': 'esporte',
  'esportes': 'esporte',
  'futebol': 'esporte',

  // 7. Personal & Shopping
  'ShoppingBag': 'sacola',
  'sacola': 'sacola',
  'compras': 'sacola',
  'Gift': 'presente',
  'presente': 'presente',
  'presentes': 'presente',
  'Tag': 'etiqueta-preco',
  'etiqueta-preco': 'etiqueta-preco',
  'Scissors': 'tesoura',
  'tesoura': 'tesoura',
  'salao': 'tesoura',
  'barbearia': 'tesoura',
  'cabelo': 'tesoura',
  'Shirt': 'roupa',
  'roupa': 'roupa',
  'vestuario': 'roupa',
  'moda': 'roupa',
  'Watch': 'relogio',
  'relogio': 'relogio',
  'Gem': 'diamante',
  'diamante': 'diamante',
  'joias': 'diamante',

  // 8. Financial
  'Dollar': 'dinheiro',
  'DollarSign': 'dinheiro',
  'dinheiro': 'dinheiro',
  'salario': 'dinheiro',
  'renda': 'dinheiro',
  'Wallet': 'carteira',
  'carteira': 'carteira',
  'PiggyBank': 'cofrinho',
  'cofrinho': 'cofrinho',
  'poupanca': 'cofrinho',
  'TrendingUp': 'grafico',
  'LineChart': 'grafico',
  'grafico': 'grafico',
  'CreditCard': 'cartao',
  'cartao': 'cartao',
  'Receipt': 'recibo',
  'recibo': 'recibo',
  'comprovante': 'recibo',
  'Lock': 'cofre',
  'Vault': 'cofre',
  'cofre': 'cofre',
  'Landmark': 'banco',
  'banco': 'banco',
  'investimento': 'investimento',
  'investimentos': 'investimento',
  'Coins': 'investimento',
  'RotateCcw': 'repetir',
  'Repeat': 'repetir',
  'repetir': 'repetir',
  'recorrente': 'repetir',
  'Sparkles': 'ia-brilho',
  'ia-brilho': 'ia-brilho',
  'extra': 'ia-brilho',
  'Star': 'estrela',
  'estrela': 'estrela',
  'Layers': 'ef-camadas',
  'ef-camadas': 'ef-camadas',
  'outros': 'ef-camadas',
  'PlusCircle': 'mais-circulo',
  'MoreHorizontal': 'es-mais-opcoes',
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
