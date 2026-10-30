export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'unpaid';
export type AppTheme = 'oled' | 'light';
export type AppLanguage = 'en' | 'pt-BR';
export type FuelType = 'gasoline' | 'ethanol';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  isDefault?: number | boolean;
}

export type CreditCardBrand =
  | 'nubank'
  | 'inter'
  | 'itau'
  | 'bradesco'
  | 'santander'
  | 'c6'
  | 'visa'
  | 'mastercard'
  | 'elo'
  | 'amex'
  | 'default'
  | 'other';

export interface CreditCard {
  id: string;
  name: string;
  brand: CreditCardBrand;
  lastDigits?: string;
  last4Digits?: string;
  color: string;
  totalLimit: number;
  closingDay: number;
  dueDay: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  status?: TransactionStatus;
  amount: number;
  description: string;
  categoryId: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  isRecurring?: boolean;
  recurringId?: string | null;
  dueDay?: number | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  totalPurchaseAmount?: number | null;
  cardId?: string | null;
  invoiceMonth?: string | null; // YYYY-MM
  purchaseDate?: string | null; // YYYY-MM-DD
  settledInvoiceKey?: string | null; // `${cardId}__${invoiceMonth}` on generated bank invoice bills
  createdAt: string;
}

export interface RecurringTemplate {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  categoryId: string;
  dayOfMonth: number;
  active: boolean;
  isInstallment?: boolean;
  totalInstallments?: number | null;
  startMonth?: string | null;
  createdAt: string;
}

export interface FuelLog {
  id: string;
  date: string; // YYYY-MM-DD
  odometer: number; // total km
  pricePerLiter: number;
  totalCost: number;
  liters: number;
  fuelType: FuelType;
  stationName: string;
  isFullTank: boolean;
  transactionId?: string | null;
  notes?: string;
  createdAt: string;
}

export interface AppSettings {
  familyName: string;
  currency: string;
  language?: AppLanguage;
  theme?: AppTheme;
  initialBalance: number;
  tankCapacity?: number;
  updatedAt: string;
}

export interface LanAddress {
  name: string;
  ip: string;
  url: string;
}

export interface NetworkInfo {
  port: number;
  primaryUrl: string;
  lanUrls: LanAddress[];
  qrCodeDataUrl: string;
  dbPath: string;
}

export interface AppState {
  settings: AppSettings;
  categories: Category[];
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
  creditCards?: CreditCard[];
  fuelLogs?: FuelLog[];
  networkInfo?: NetworkInfo;
}
