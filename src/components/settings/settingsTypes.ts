import { AppLanguage, AppState, AppTheme, Category, TransactionType } from '../../types';
import { BackupSummary } from '../../utils/backup';

export type SettingsSubScreen =
  | 'index'
  | 'balance'
  | 'preferences'
  | 'categories'
  | 'pairing'
  | 'backup'
  | 'export';

export interface MobileSyncModalProps {
  isOpen: boolean;
  activeTabInitial?: 'mobile' | 'settings' | 'categories' | 'export' | 'backup';
  state: AppState;
  language: AppLanguage;
  theme: AppTheme;
  isOnlineWithServer: boolean;
  pendingOfflineCount: number;
  currentBankBalance?: number;
  familyId?: string | null;
  masterKey?: string | null;
  onLeaveFamily?: () => void;
  onOpenBalanceModal?: () => void;
  onClose: () => void;
  onUpdateSettings: (payload: {
    familyName?: string;
    currency?: string;
    language?: AppLanguage;
    theme?: AppTheme;
    initialBalance?: number;
    targetCurrentBalance?: number;
  }) => Promise<void>;
  onAddCategory: (cat: {
    name: string;
    type: TransactionType;
    color: string;
    icon: string;
  }) => Promise<Category | void>;
  onCategoryCreated?: (cat: Category) => void;
  onUpdateCategory: (
    id: string,
    cat: { name: string; type: TransactionType; color: string; icon: string }
  ) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onImportBackup: (
    data: unknown,
    mode: 'merge' | 'replace'
  ) => Promise<{ warnings: string[]; offline: boolean }>;
  onExportBackup: () => BackupSummary;
  onResetAccount: () => Promise<void>;
}

export const PRESET_COLORS = [
  '#10B981', // Emerald
  '#2DD4BF', // Mint
  '#059669', // Forest
  '#14B8A6', // Teal
  '#0EA5E9', // Sky
  '#06B6D4', // Cyan
  '#2563EB', // Royal Blue
  '#4F46E5', // Indigo
  '#8B5CF6', // Purple
  '#7C3AED', // Violet
  '#D946EF', // Fuchsia
  '#F43F5E', // Rose
  '#E11D48', // Crimson
  '#EF4444', // Red
  '#F97316', // Coral
  '#F59E0B', // Amber
  '#EAB308', // Gold
  '#84CC16', // Lime
  '#9A6B48', // Bronze
  '#6E5440', // Iron
  '#475569', // Slate Blue
  '#334155', // Charcoal
  '#64748B', // Neutral Gray
  '#1E293B', // Navy
];

export function mapInitialTabToSubScreen(
  tab?: 'mobile' | 'settings' | 'categories' | 'export' | 'backup'
): SettingsSubScreen {
  if (tab === 'export') return 'export';
  if (tab === 'categories') return 'categories';
  if (tab === 'backup') return 'backup';
  if (tab === 'mobile') return 'pairing';
  return 'index';
}

export function getSettingsHeaderTitle(
  subScreen: SettingsSubScreen,
  language: AppLanguage
): string {
  switch (subScreen) {
    case 'balance':
      return language === 'pt-BR' ? 'Saldo Inicial e Ajuste' : 'Starting Balance & Adjustment';
    case 'preferences':
      return language === 'pt-BR' ? 'Idioma e Moeda' : 'Language & Currency';
    case 'categories':
      return language === 'pt-BR' ? 'Gerenciar Categorias' : 'Manage Categories';
    case 'pairing':
      return language === 'pt-BR' ? 'Pareamento Familiar' : 'Family Pairing';
    case 'backup':
      return language === 'pt-BR' ? 'Servidor e Backup' : 'Server & Backup';
    case 'export':
      return language === 'pt-BR' ? 'Exportar Dados' : 'Export Data';
    case 'index':
    default:
      return language === 'pt-BR' ? 'Configurações' : 'Settings';
  }
}
