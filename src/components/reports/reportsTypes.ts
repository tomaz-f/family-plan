import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  FuelLog,
  RecurringTemplate,
  Transaction,
} from '../../types';

export interface ReportsViewProps {
  selectedMonth: string;
  familyName: string;
  currency: string;
  language: AppLanguage;
  theme?: AppTheme;
  initialBalance: number;
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  recurringTemplates?: RecurringTemplate[];
  fuelLogs?: FuelLog[];
  onSelectMonth?: (month: string) => void;
}

export interface CategorySliceItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  count: number;
  share: number;
}

export interface NonCardInstallmentPlan {
  key: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  monthlyAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  currentInstallmentDisplay: number;
  totalAmount: number;
  totalPaidAmount: number;
  remainingDebtAmount: number;
  progressPct: number;
  paymentMethod: string;
  isDueInSelectedMonth: boolean;
  selectedMonthAmount: number;
  installmentSchedule: number[];
}

export interface AmortizationTimelinePoint {
  index: number;
  month: string;
  shortMonthLabel: string;
  yearLabel: string;
  fullMonthLabel: string;
  monthlyCommitment: number;
  remainingBalance: number;
  activeCount: number;
}

export interface InstallmentExpenseTrackerProps {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  language: AppLanguage;
  selectedMonth?: string;
  theme?: AppTheme;
}

export interface MonthCommitmentProjection {
  month: string;
  shortMonthLabel: string;
  yearLabel: string;
  invoicesAmount: number;
  installmentsAmount: number;
  recurringAmount: number;
  totalCommitment: number;
  invoicesCount: number;
  installmentsCount: number;
  recurringCount: number;
}

export interface FutureCommitmentsForecastProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  theme?: AppTheme;
  creditCards?: CreditCard[];
  transactions: Transaction[];
  recurringTemplates?: RecurringTemplate[];
}

export const FALLBACK_SLICE_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#D0B595',
  '#6366F1',
];

export const INVOICE_SLICE_ID = 'credit-card-invoices';

// 8 logical cards wrapped with adjacent virtual buffers [Card 7, Card 0..7, Card 0]
// for seamless infinite circular wrap-around in both directions
export const VIRTUAL_SLIDE_MAP = [7, 0, 1, 2, 3, 4, 5, 6, 7, 0] as const;

export const REPORT_SLIDES = [
  { index: 0, labelPt: 'Categorias Gerais', labelEn: 'General Categories' },
  { index: 1, labelPt: 'Gastos no Cartão', labelEn: 'Card Spending' },
  { index: 2, labelPt: 'Evolução Mensal', labelEn: 'Monthly Evolution' },
  { index: 3, labelPt: 'Curva do Saldo', labelEn: 'Balance Curve' },
  { index: 4, labelPt: 'Parcelamentos Futuros', labelEn: 'Future Installments' },
  { index: 5, labelPt: 'Ritmo de Gastos', labelEn: 'Spending Pace' },
  { index: 6, labelPt: 'Fixos vs. Variáveis', labelEn: 'Fixed vs. Variable' },
  { index: 7, labelPt: 'Eficiência de Combustível', labelEn: 'Fuel Efficiency' },
] as const;

export const DONUT_SVG_SIZE = 220;
export const DONUT_CENTER = DONUT_SVG_SIZE / 2;
export const DONUT_RADIUS = 84;
export const DONUT_STROKE_WIDTH = 28;
