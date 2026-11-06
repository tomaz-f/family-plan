import { Category, CreditCard, Transaction } from '../../types';
import { decryptPayload, encryptPayload } from './cryptoPrimitives';

export async function encryptTransaction(
  tx: Transaction,
  masterKey: string,
  familyId: string
): Promise<{
  id: string;
  type: string;
  date: string;
  status: string;
  createdAt: string;
  cardId?: string | null;
  invoiceMonth?: string | null;
  purchaseDate?: string | null;
  settledInvoiceKey?: string | null;
  dueDay?: number | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  totalPurchaseAmount?: number | null;
  recurringId?: string | null;
  iv: string;
  payload: string;
  encrypted_data: string;
}> {
  const sensitive = {
    amount: tx.amount,
    description: tx.description,
    categoryId: tx.categoryId,
    notes: tx.notes || '',
    recurringId: tx.recurringId || null,
    dueDay: tx.dueDay || null,
    installmentCurrent: tx.installmentCurrent || null,
    installmentTotal: tx.installmentTotal || null,
    totalPurchaseAmount: tx.totalPurchaseAmount || null,
    cardId: tx.cardId || null,
    invoiceMonth: tx.invoiceMonth || null,
    purchaseDate: tx.purchaseDate || null,
    settledInvoiceKey: tx.settledInvoiceKey || null,
  };

  const encrypted_data = await encryptPayload(sensitive, masterKey, familyId);
  const parts = encrypted_data.split(':');
  const iv = parts[1] || '';
  const payload = parts[2] || '';

  return {
    id: tx.id,
    type: tx.type,
    date: tx.date,
    status: tx.status || 'paid',
    createdAt: tx.createdAt || new Date().toISOString(),
    cardId: tx.cardId || null,
    invoiceMonth: tx.invoiceMonth || null,
    purchaseDate: tx.purchaseDate || null,
    settledInvoiceKey: tx.settledInvoiceKey || null,
    dueDay: tx.dueDay ? Number(tx.dueDay) : null,
    installmentCurrent: tx.installmentCurrent ? Number(tx.installmentCurrent) : null,
    installmentTotal: tx.installmentTotal ? Number(tx.installmentTotal) : null,
    totalPurchaseAmount: tx.totalPurchaseAmount ? Number(tx.totalPurchaseAmount) : null,
    recurringId: tx.recurringId || null,
    iv,
    payload,
    encrypted_data,
  };
}

export async function decryptTransaction(
  raw: any,
  masterKey: string,
  familyId: string
): Promise<Transaction> {
  const encData = raw.encrypted_data || (raw.iv && raw.payload ? `v1:${raw.iv}:${raw.payload}` : null);
  if (!encData) {
    // Fallback for unencrypted legacy rows
    return {
      id: raw.id,
      type: raw.type,
      amount: Number(raw.amount || 0),
      description: raw.description || '',
      categoryId: raw.categoryId || '',
      date: raw.date || '',
      notes: raw.notes || '',
      recurringId: raw.recurringId || null,
      dueDay: raw.dueDay ? Number(raw.dueDay) : null,
      installmentCurrent: raw.installmentCurrent ? Number(raw.installmentCurrent) : null,
      installmentTotal: raw.installmentTotal ? Number(raw.installmentTotal) : null,
      totalPurchaseAmount: raw.totalPurchaseAmount ? Number(raw.totalPurchaseAmount) : null,
      status: raw.status || 'paid',
      cardId: raw.cardId || null,
      invoiceMonth: raw.invoiceMonth || null,
      purchaseDate: raw.purchaseDate || null,
      settledInvoiceKey: raw.settledInvoiceKey || null,
      createdAt: raw.createdAt || new Date().toISOString(),
    };
  }

  try {
    const sensitive = await decryptPayload<any>(encData, masterKey, familyId);
    return {
      id: raw.id,
      type: raw.type,
      status: raw.status || 'paid',
      date: raw.date,
      createdAt: raw.createdAt,
      amount: Number(sensitive.amount || 0),
      description: sensitive.description || '',
      categoryId: sensitive.categoryId || '',
      notes: sensitive.notes || '',
      recurringId: sensitive.recurringId || raw.recurringId || null,
      dueDay: sensitive.dueDay ? Number(sensitive.dueDay) : raw.dueDay ? Number(raw.dueDay) : null,
      installmentCurrent: sensitive.installmentCurrent
        ? Number(sensitive.installmentCurrent)
        : raw.installmentCurrent
        ? Number(raw.installmentCurrent)
        : null,
      installmentTotal: sensitive.installmentTotal
        ? Number(sensitive.installmentTotal)
        : raw.installmentTotal
        ? Number(raw.installmentTotal)
        : null,
      totalPurchaseAmount: sensitive.totalPurchaseAmount
        ? Number(sensitive.totalPurchaseAmount)
        : raw.totalPurchaseAmount
        ? Number(raw.totalPurchaseAmount)
        : null,
      cardId: raw.cardId !== undefined ? (raw.cardId || null) : (sensitive.cardId || null),
      invoiceMonth: raw.invoiceMonth !== undefined ? (raw.invoiceMonth || null) : (sensitive.invoiceMonth || null),
      purchaseDate: raw.purchaseDate !== undefined ? (raw.purchaseDate || null) : (sensitive.purchaseDate || null),
      settledInvoiceKey: raw.settledInvoiceKey !== undefined ? (raw.settledInvoiceKey || null) : (sensitive.settledInvoiceKey || null),
    };
  } catch (err) {
    console.error(`[Crypto] Failed to decrypt transaction ${raw.id}:`, err);
    return {
      id: raw.id,
      type: raw.type,
      status: raw.status || 'paid',
      date: raw.date,
      createdAt: raw.createdAt,
      amount: 0,
      description: '🔒 [Dado Cifrado]',
      categoryId: 'exp-other',
      notes: '',
    };
  }
}

export async function encryptCategory(
  cat: Category,
  masterKey: string,
  familyId: string
): Promise<{
  id: string;
  type: string;
  isDefault: number;
  iv: string;
  payload: string;
  encrypted_data: string;
}> {
  const sensitive = {
    name: cat.name,
    color: cat.color,
    icon: cat.icon,
  };
  const encrypted_data = await encryptPayload(sensitive, masterKey, familyId);
  const parts = encrypted_data.split(':');
  const iv = parts[1] || '';
  const payload = parts[2] || '';
  return {
    id: cat.id,
    type: cat.type,
    isDefault: cat.isDefault ? 1 : 0,
    iv,
    payload,
    encrypted_data,
  };
}

export async function decryptCategory(
  raw: any,
  masterKey: string,
  familyId: string
): Promise<Category> {
  const encData = raw.encrypted_data || (raw.iv && raw.payload ? `v1:${raw.iv}:${raw.payload}` : null);
  if (!encData) {
    return {
      id: raw.id,
      name: raw.name || '',
      type: raw.type,
      color: raw.color || '#6366f1',
      icon: raw.icon || 'Tag',
      isDefault: Number(raw.isDefault || 0),
    };
  }

  try {
    const sensitive = await decryptPayload<any>(encData, masterKey, familyId);
    return {
      id: raw.id,
      type: raw.type,
      isDefault: Number(raw.isDefault || 0),
      name: sensitive.name || '',
      color: sensitive.color || '#6366f1',
      icon: sensitive.icon || 'Tag',
    };
  } catch (err) {
    console.error(`[Crypto] Failed to decrypt category ${raw.id}:`, err);
    return {
      id: raw.id,
      type: raw.type,
      isDefault: Number(raw.isDefault || 0),
      name: 'Categoria Cifrada',
      color: '#64748b',
      icon: 'Tag',
    };
  }
}

export async function encryptCreditCard(
  card: CreditCard,
  masterKey: string,
  familyId: string
): Promise<{
  id: string;
  createdAt: string;
  iv: string;
  payload: string;
  encrypted_data: string;
}> {
  const sensitive = {
    name: card.name,
    brand: card.brand,
    last4Digits: card.lastDigits || card.last4Digits || '',
    color: card.color,
    totalLimit: card.totalLimit,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
  };
  const encrypted_data = await encryptPayload(sensitive, masterKey, familyId);
  const parts = encrypted_data.split(':');
  const iv = parts[1] || '';
  const payload = parts[2] || '';
  return {
    id: card.id,
    createdAt: card.createdAt || new Date().toISOString(),
    iv,
    payload,
    encrypted_data,
  };
}

export async function decryptCreditCard(
  raw: any,
  masterKey: string,
  familyId: string
): Promise<CreditCard> {
  const encData = raw.encrypted_data || (raw.iv && raw.payload ? `v1:${raw.iv}:${raw.payload}` : null);
  if (!encData) {
    return {
      id: raw.id,
      name: raw.name || '',
      brand: raw.brand || 'other',
      lastDigits: raw.last4Digits || raw.lastDigits || '',
      color: raw.color || '#8b5cf6',
      totalLimit: Number(raw.totalLimit || 0),
      closingDay: Number(raw.closingDay || 25),
      dueDay: Number(raw.dueDay || 5),
      createdAt: raw.createdAt,
    };
  }

  try {
    const sensitive = await decryptPayload<any>(encData, masterKey, familyId);
    const digits = sensitive.last4Digits || sensitive.lastDigits || raw.last4Digits || raw.lastDigits || '';
    return {
      id: raw.id,
      createdAt: raw.createdAt,
      name: sensitive.name || 'Cartão',
      brand: sensitive.brand || raw.brand || 'other',
      lastDigits: digits,
      last4Digits: digits,
      color: sensitive.color || raw.color || '#8b5cf6',
      totalLimit: Number(sensitive.totalLimit ?? raw.totalLimit ?? 0),
      closingDay: Number(sensitive.closingDay ?? raw.closingDay ?? 25),
      dueDay: Number(sensitive.dueDay ?? raw.dueDay ?? 5),
    };
  } catch (err) {
    console.error(`[Crypto] Failed to decrypt card ${raw.id}:`, err);
    return {
      id: raw.id,
      createdAt: raw.createdAt,
      name: '🔒 Cartão Cifrado',
      brand: 'other',
      lastDigits: '',
      color: '#64748b',
      totalLimit: 0,
      closingDay: 25,
      dueDay: 5,
    };
  }
}
