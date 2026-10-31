import React from 'react';
import {
  Landmark,
  Briefcase,
  Sparkles,
  RotateCcw,
  PlusCircle,
  ShoppingCart,
  Home,
  Zap,
  Utensils,
  Car,
  HeartPulse,
  GraduationCap,
  ShoppingBag,
  Film,
  MoreHorizontal,
  Tag,
  Wallet,
  CreditCard,
  Gift,
  Plane,
  Wifi,
  Smartphone,
  Coffee,
  Dumbbell,
  PawPrint,
  Gamepad2,
  Tv,
  Layers,
  TrendingUp,
} from 'lucide-react';

export const AVAILABLE_ICONS = [
  'Home',
  'ShoppingBag',
  'Car',
  'HeartPulse',
  'Gamepad2',
  'GraduationCap',
  'Tv',
  'Zap',
  'Layers',
  'Briefcase',
  'Sparkles',
  'TrendingUp',
  'Landmark',
  'RotateCcw',
  'PlusCircle',
  'ShoppingCart',
  'Utensils',
  'Film',
  'Wallet',
  'CreditCard',
  'Gift',
  'Plane',
  'Wifi',
  'Smartphone',
  'Coffee',
  'Dumbbell',
  'PawPrint',
  'Tag',
  'MoreHorizontal',
] as const;

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Home,
  ShoppingBag,
  Car,
  HeartPulse,
  Gamepad2,
  GraduationCap,
  Tv,
  Zap,
  Layers,
  Briefcase,
  Sparkles,
  TrendingUp,
  Landmark,
  RotateCcw,
  PlusCircle,
  ShoppingCart,
  Utensils,
  Film,
  MoreHorizontal,
  Tag,
  Wallet,
  CreditCard,
  Gift,
  Plane,
  Wifi,
  Smartphone,
  Coffee,
  Dumbbell,
  PawPrint,
};

interface CategoryIconProps {
  icon?: string;
  color?: string;
  size?: number;
  className?: string;
  badgeSize?: 'sm' | 'md' | 'lg';
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  color = '#6366f1',
  size = 18,
  className = '',
  badgeSize,
}) => {
  const IconComp = (icon && ICON_MAP[icon]) || Tag;

  if (!badgeSize) {
    return <IconComp size={size} className={className} />;
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
      <IconComp size={size} />
    </div>
  );
};
